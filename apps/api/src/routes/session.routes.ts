import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireTablet } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { db } from '../db/connection.js';
import { decrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/error-handler.js';
import { computeSessionMetrics } from '../services/metrics.service.js';
import { evaluateFlags } from '../services/flags.service.js';
import { logger } from '../config/logger.js';
import type { GameType } from '@kite/shared';

export const sessionRouter: import('express').IRouter = Router();

sessionRouter.use(authenticate);

// GET /sessions/patients/today
sessionRouter.get(
  '/patients/today',
  requireTablet,
  audit({ action: 'patient.view', resourceType: 'patient' }),
  async (req, res, next) => {
    try {
      const clinicId = req.user!.clinicId;
      const patients = await db('patients')
        .where({ clinic_id: clinicId, is_deleted: false });

      const today = new Date().toISOString().slice(0, 10);
      const todaySessions = await db('sessions')
        .where({ clinic_id: clinicId })
        .whereRaw("started_at::date = ?", [today])
        .select('patient_id');
      const todayPatientIds = new Set(todaySessions.map((s: { patient_id: string }) => s.patient_id));

      const result = patients.map((p: Record<string, unknown>) => {
        const firstName = decrypt(p.first_name_encrypted as Buffer);
        const lastName = decrypt(p.last_name_encrypted as Buffer);
        const dob = decrypt(p.date_of_birth_encrypted as Buffer);
        const ageMonths = calculateAgeMonths(new Date(dob));
        return {
          id: p.id,
          firstName,
          lastInitial: lastName.charAt(0),
          ageMonths,
          ageDisplay: formatAge(ageMonths),
          hasSessionToday: todayPatientIds.has(p.id as string),
        };
      });

      res.json({ patients: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /sessions
const createSessionSchema = z.object({
  patientId: z.string().uuid(),
  tabletId: z.string().uuid(),
  consentGivenAt: z.string().datetime(),
});

sessionRouter.post(
  '/',
  requireTablet,
  validate(createSessionSchema),
  audit({ action: 'session.create', resourceType: 'session' }),
  async (req, res, next) => {
    try {
      const { patientId, tabletId, consentGivenAt } = req.body;
      const clinicId = req.user!.clinicId;
      const staffUserId = req.user!.sub;

      const patient = await db('patients').where({ id: patientId, clinic_id: clinicId }).first();
      if (!patient) {
        throw new AppError(404, 'NOT_FOUND', 'Patient not found');
      }

      const dob = decrypt(patient.date_of_birth_encrypted);
      const ageMonths = calculateAgeMonths(new Date(dob));

      const [session] = await db('sessions')
        .insert({
          patient_id: patientId,
          clinic_id: clinicId,
          tablet_id: tabletId,
          staff_user_id: staffUserId,
          consent_given_at: consentGivenAt,
          started_at: new Date(),
          patient_age_months: ageMonths,
        })
        .returning('*');

      const difficultyPreset = getDifficultyPreset(ageMonths);
      const games: GameType[] = ['cloud_catch', 'star_sequence', 'sky_sigils', 'sky_sort'];

      res.status(201).json({
        sessionId: session.id,
        patientAgeMonths: ageMonths,
        gamesConfig: { games, difficultyPreset },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /sessions/:sessionId/events
const gameEventsSchema = z.object({
  gameType: z.enum(['cloud_catch', 'star_sequence', 'sky_sigils', 'sky_sort']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  durationMs: z.number().int().positive(),
  events: z.array(z.record(z.unknown())),
});

sessionRouter.post(
  '/:sessionId/events',
  requireTablet,
  validate(gameEventsSchema),
  async (req, res, next) => {
    try {
      const sessionId = req.params.sessionId as string;
      const { gameType, startedAt, completedAt, durationMs, events } = req.body;

      const session = await db('sessions').where({ id: sessionId }).first();
      if (!session) {
        throw new AppError(404, 'NOT_FOUND', 'Session not found');
      }

      const [gameResult] = await db('game_results')
        .insert({
          session_id: sessionId,
          game_type: gameType,
          started_at: startedAt,
          completed_at: completedAt,
          duration_ms: durationMs,
          raw_events: JSON.stringify(events),
        })
        .returning('*');

      res.status(201).json({ gameResultId: gameResult.id });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /sessions/:sessionId/complete
const completeSessionSchema = z.object({
  completedAt: z.string().datetime(),
  gamesCompleted: z.number().int().min(0).max(4),
  totalDurationMs: z.number().int().positive(),
});

sessionRouter.patch(
  '/:sessionId/complete',
  requireTablet,
  validate(completeSessionSchema),
  async (req, res, next) => {
    try {
      const sessionId = req.params.sessionId as string;
      const { completedAt, gamesCompleted, totalDurationMs } = req.body;

      const session = await db('sessions').where({ id: sessionId }).first();
      if (!session) {
        throw new AppError(404, 'NOT_FOUND', 'Session not found');
      }

      await db('sessions').where({ id: sessionId }).update({
        completed_at: completedAt,
        status: 'completed',
        games_completed: gamesCompleted,
        total_duration_ms: totalDurationMs,
      });

      // Trigger metrics pipeline asynchronously
      let metricsComputed = false;
      try {
        await computeSessionMetrics(sessionId);
        await evaluateFlags(session.patient_id, sessionId);
        metricsComputed = true;
      } catch (err) {
        logger.error({ err, sessionId }, 'Metrics pipeline failed — session still marked complete');
        // Retry in background
        setTimeout(async () => {
          try {
            await computeSessionMetrics(sessionId);
            await evaluateFlags(session.patient_id, sessionId);
          } catch (retryErr) {
            logger.error({ err: retryErr, sessionId }, 'Metrics pipeline retry also failed');
          }
        }, 5000);
      }

      res.json({ sessionId, status: 'completed', metricsComputed });
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

function getDifficultyPreset(ageMonths: number): string {
  if (ageMonths < 54) return 'age_4';
  if (ageMonths < 66) return 'age_5';
  if (ageMonths < 78) return 'age_6';
  return 'age_7';
}
