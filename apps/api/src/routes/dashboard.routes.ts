import { Router } from 'express';
import { z } from 'zod';
import { validate, validateQuery } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { db } from '../db/connection.js';
import { decrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/error-handler.js';

export const dashboardRouter: import('express').IRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.use(requireRole('admin', 'clinician'));

// GET /dashboard/patients
const patientsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().optional(),
  status: z.enum(['all', 'flagged', 'red']).default('all'),
  sort: z.string().default('lastVisit'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

dashboardRouter.get(
  '/patients',
  validateQuery(patientsQuerySchema),
  audit({ action: 'patient.view', resourceType: 'patient' }),
  async (req, res, next) => {
    try {
      const clinicId = req.user!.clinicId;
      const { page, limit, search, status, sort, order } = req.query as unknown as z.infer<typeof patientsQuerySchema>;

      // Fetch all patients for the clinic (decrypt in memory for search/sort)
      const patients = await db('patients')
        .where({ clinic_id: clinicId, is_deleted: false });

      // Decrypt and build patient list items
      let items = await Promise.all(
        patients.map(async (p: Record<string, unknown>) => {
          const firstName = decrypt(p.first_name_encrypted as Buffer);
          const lastName = decrypt(p.last_name_encrypted as Buffer);
          const dob = decrypt(p.date_of_birth_encrypted as Buffer);
          const ageMonths = calculateAgeMonths(new Date(dob));

          // Get session info
          const sessionInfo = await db('sessions')
            .where({ patient_id: p.id as string })
            .count('* as total')
            .max('started_at as last_visit')
            .first();

          // Get active flags
          const flagInfo = await db('flags')
            .where({ patient_id: p.id as string, is_dismissed: false })
            .select('severity');

          const activeFlagCount = flagInfo.length;
          let flagStatus: string = 'green';
          if (flagInfo.some((f: { severity: string }) => f.severity === 'red')) {
            flagStatus = 'red';
          } else if (flagInfo.some((f: { severity: string }) => f.severity === 'amber')) {
            flagStatus = 'amber';
          }

          return {
            id: p.id as string,
            firstName,
            lastName,
            dateOfBirth: dob,
            ageMonths,
            ageDisplay: formatAge(ageMonths),
            totalSessions: Number(sessionInfo?.total ?? 0),
            lastVisit: sessionInfo?.last_visit
              ? new Date(sessionInfo.last_visit as string).toISOString().slice(0, 10)
              : null,
            flagStatus,
            activeFlagCount,
          };
        }),
      );

      // Filter by search
      if (search) {
        const lowerSearch = search.toLowerCase();
        items = items.filter(
          (i) =>
            i.firstName.toLowerCase().includes(lowerSearch) ||
            i.lastName.toLowerCase().includes(lowerSearch),
        );
      }

      // Filter by status
      if (status === 'flagged') {
        items = items.filter((i) => i.flagStatus !== 'green');
      } else if (status === 'red') {
        items = items.filter((i) => i.flagStatus === 'red');
      }

      // Sort
      const sortKey = sort === 'lastVisit' ? 'lastVisit' : sort === 'name' ? 'lastName' : sort as keyof typeof items[0];
      items.sort((a, b) => {
        const aVal = a[sortKey as keyof typeof a] ?? '';
        const bVal = b[sortKey as keyof typeof b] ?? '';
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
      });

      const total = items.length;
      const offset = (page - 1) * limit;
      const paged = items.slice(offset, offset + limit);

      res.json({ patients: paged, total, page, limit });
    } catch (err) {
      next(err);
    }
  },
);

// GET /dashboard/patients/:patientId
dashboardRouter.get(
  '/patients/:patientId',
  audit({ action: 'patient.view', resourceType: 'patient', getResourceId: (req) => req.params.patientId }),
  async (req, res, next) => {
    try {
      const patientId = req.params.patientId as string;
      const clinicId = req.user!.clinicId;

      const patient = await db('patients')
        .where({ id: patientId, clinic_id: clinicId, is_deleted: false })
        .first();

      if (!patient) {
        throw new AppError(404, 'NOT_FOUND', 'Patient not found');
      }

      const firstName = decrypt(patient.first_name_encrypted);
      const lastName = decrypt(patient.last_name_encrypted);
      const dob = decrypt(patient.date_of_birth_encrypted);
      const guardianName = patient.guardian_name_encrypted
        ? decrypt(patient.guardian_name_encrypted)
        : null;
      const ageMonths = calculateAgeMonths(new Date(dob));

      // Fetch all sessions with game results
      const sessions = await db('sessions')
        .where({ patient_id: patientId })
        .orderBy('started_at', 'desc');

      const sessionsWithGames = await Promise.all(
        sessions.map(async (s: Record<string, unknown>) => {
          const gameResults = await db('game_results')
            .where({ session_id: s.id as string });

          return {
            id: s.id,
            date: new Date(s.started_at as string).toISOString().slice(0, 10),
            ageMonths: s.patient_age_months,
            gamesPlayed: s.games_completed,
            durationMs: s.total_duration_ms,
            games: gameResults.map((g: Record<string, unknown>) => ({
              gameType: g.game_type,
              metrics: g.computed_metrics ?? {},
            })),
          };
        }),
      );

      res.json({
        patient: { id: patientId, firstName, lastName, dateOfBirth: dob, ageMonths, guardianName },
        sessions: sessionsWithGames,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /dashboard/patients/:patientId/metrics
dashboardRouter.get(
  '/patients/:patientId/metrics',
  audit({ action: 'metrics.view', resourceType: 'patient', getResourceId: (req) => req.params.patientId }),
  async (req, res, next) => {
    try {
      const patientId = req.params.patientId as string;
      const { metricName, gameType, from, to } = req.query as Record<string, string | undefined>;

      let query = db('patient_metrics')
        .where({ patient_id: patientId })
        .orderBy('recorded_at', 'asc');

      if (metricName) query = query.where({ metric_name: metricName });
      if (gameType) query = query.where({ game_type: gameType });
      if (from) query = query.where('recorded_at', '>=', from);
      if (to) query = query.where('recorded_at', '<=', to);

      const rows = await query;

      // Group by metric_name + game_type
      const grouped = new Map<string, typeof rows>();
      for (const row of rows) {
        const key = `${row.metric_name}:${row.game_type}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(row);
      }

      const metrics = Array.from(grouped.entries()).map(([key, points]) => {
        const [name, game] = key.split(':');
        const dataPoints = points.map((p: Record<string, unknown>) => ({
          sessionId: p.session_id,
          date: new Date(p.recorded_at as string).toISOString().slice(0, 10),
          ageMonths: p.age_months,
          value: Number(p.metric_value),
          percentile: p.percentile != null ? Number(p.percentile) : null,
        }));

        // Calculate trend
        const trend = calculateTrend(dataPoints.map((d) => d.value));

        return {
          metricName: name,
          gameType: game,
          dataPoints,
          trend,
          latestPercentile: dataPoints.length > 0 ? dataPoints[dataPoints.length - 1]!.percentile : null,
        };
      });

      res.json({ metrics });
    } catch (err) {
      next(err);
    }
  },
);

// GET /dashboard/patients/:patientId/flags
dashboardRouter.get(
  '/patients/:patientId/flags',
  audit({ action: 'metrics.view', resourceType: 'flag', getResourceId: (req) => req.params.patientId }),
  async (req, res, next) => {
    try {
      const patientId = req.params.patientId as string;
      const includeDismissed = req.query.includeDismissed === 'true';

      let query = db('flags').where({ patient_id: patientId });
      if (!includeDismissed) {
        query = query.where({ is_dismissed: false });
      }

      const flags = await query.orderBy('created_at', 'desc');

      res.json({
        flags: flags.map((f: Record<string, unknown>) => ({
          id: f.id,
          severity: f.severity,
          flagType: f.flag_type,
          metricName: f.metric_name,
          gameType: f.game_type,
          description: f.description,
          currentValue: f.current_value != null ? Number(f.current_value) : null,
          thresholdPercentile: f.threshold_value != null ? Number(f.threshold_value) : null,
          actualPercentile: null,
          createdAt: f.created_at,
          isDismissed: f.is_dismissed,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /dashboard/flags/:flagId/dismiss
const dismissSchema = z.object({
  reason: z.string().min(1),
});

dashboardRouter.patch(
  '/flags/:flagId/dismiss',
  validate(dismissSchema),
  audit({ action: 'flag.dismiss', resourceType: 'flag', getResourceId: (req) => req.params.flagId }),
  async (req, res, next) => {
    try {
      const flagId = req.params.flagId as string;
      const { reason } = req.body;

      const flag = await db('flags').where({ id: flagId }).first();
      if (!flag) {
        throw new AppError(404, 'NOT_FOUND', 'Flag not found');
      }

      await db('flags').where({ id: flagId }).update({
        is_dismissed: true,
        dismissed_by: req.user!.sub,
        dismissed_at: new Date(),
        dismiss_reason: reason,
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

function calculateAgeMonths(dob: Date): number {
  const now = new Date();
  return (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
}

function formatAge(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years} yrs ${remainingMonths} mos`;
}

function calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
  if (values.length < 2) return 'stable';
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  if (slope > 0.01) return 'improving';
  if (slope < -0.01) return 'declining';
  return 'stable';
}
