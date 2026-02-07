import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { db } from '../db/connection.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { hashPassword, hashPin } from '../services/auth.service.js';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../config/logger.js';

export const adminRouter: import('express').IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

adminRouter.use(authenticate);
adminRouter.use(requireRole('admin'));

// ========================= STAFF =========================

// GET /admin/staff
adminRouter.get('/staff', async (req, res, next) => {
  try {
    const clinicId = req.user!.clinicId;
    const staff = await db('users')
      .where({ clinic_id: clinicId })
      .select('id', 'name', 'email', 'role', 'is_active', 'created_at')
      .orderBy('created_at', 'desc');

    res.json({
      staff: staff.map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.name,
        email: s.email ?? null,
        role: s.role,
        isActive: s.is_active,
        createdAt: new Date(s.created_at as string).toISOString().slice(0, 10),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/staff
const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'clinician', 'staff']),
  pin: z.string().min(4).max(6).optional(),
  password: z.string().min(8).optional(),
});

adminRouter.post(
  '/staff',
  validate(createStaffSchema),
  audit({ action: 'staff.create', resourceType: 'user' }),
  async (req, res, next) => {
    try {
      const clinicId = req.user!.clinicId;
      const { name, email, role, pin, password } = req.body;

      const passwordHash = password ? await hashPassword(password) : null;
      const pinHash = pin ? await hashPin(pin) : null;

      const [user] = await db('users')
        .insert({
          clinic_id: clinicId,
          name,
          email: email ?? null,
          role,
          password_hash: passwordHash,
          pin_hash: pinHash,
        })
        .returning('*');

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
      });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/staff/:staffId (soft delete)
adminRouter.delete(
  '/staff/:staffId',
  audit({ action: 'staff.delete', resourceType: 'user', getResourceId: (req) => req.params.staffId }),
  async (req, res, next) => {
    try {
      const staffId = req.params.staffId as string;
      await db('users').where({ id: staffId }).update({ is_active: false });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/staff/:staffId/reset-pin
const resetPinSchema = z.object({
  newPin: z.string().min(4).max(6),
});

adminRouter.patch(
  '/staff/:staffId/reset-pin',
  validate(resetPinSchema),
  audit({ action: 'staff.update', resourceType: 'user', getResourceId: (req) => req.params.staffId }),
  async (req, res, next) => {
    try {
      const staffId = req.params.staffId as string;
      const { newPin } = req.body;
      const pinHash = await hashPin(newPin);
      await db('users').where({ id: staffId }).update({ pin_hash: pinHash });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// ========================= TABLETS =========================

// GET /admin/tablets
adminRouter.get('/tablets', async (req, res, next) => {
  try {
    const clinicId = req.user!.clinicId;
    const tablets = await db('tablets').where({ clinic_id: clinicId }).orderBy('registered_at', 'desc');

    res.json({
      tablets: tablets.map((t: Record<string, unknown>) => ({
        id: t.id,
        deviceName: t.device_name ?? null,
        model: t.model ?? null,
        lastSeenAt: t.last_seen_at ? new Date(t.last_seen_at as string).toISOString() : null,
        isActive: t.is_active,
        registeredAt: t.registered_at ? new Date(t.registered_at as string).toISOString() : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/tablets
const createTabletSchema = z.object({
  deviceName: z.string().min(1),
});

adminRouter.post(
  '/tablets',
  validate(createTabletSchema),
  audit({ action: 'tablet.create', resourceType: 'tablet' }),
  async (req, res, next) => {
    try {
      const clinicId = req.user!.clinicId;
      const { deviceName } = req.body;

      const deviceToken = randomBytes(32).toString('hex');
      const deviceTokenHash = await bcrypt.hash(deviceToken, 12);

      const [tablet] = await db('tablets')
        .insert({
          clinic_id: clinicId,
          device_token_hash: deviceTokenHash,
          device_name: deviceName,
        })
        .returning('*');

      // Generate QR code data (base64 encoded token info)
      const qrData = Buffer.from(JSON.stringify({
        tabletId: tablet.id,
        deviceToken,
      })).toString('base64');

      res.status(201).json({
        tabletId: tablet.id,
        deviceToken,
        pairingQrCode: `data:text/plain;base64,${qrData}`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ========================= PATIENT IMPORT =========================

// POST /admin/patients/import
adminRouter.post(
  '/patients/import',
  upload.single('file'),
  audit({ action: 'patient.import', resourceType: 'patient' }),
  async (req, res, next) => {
    try {
      const clinicId = req.user!.clinicId;
      if (!req.file) {
        throw new AppError(400, 'VALIDATION_ERROR', 'CSV file required');
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];

      let imported = 0;
      let skipped = 0;
      const errors: { row: number; error: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i]!;
        const rowNum = i + 2; // 1-indexed, skip header

        try {
          if (!row.first_name || !row.last_name || !row.date_of_birth) {
            errors.push({ row: rowNum, error: 'Missing required field (first_name, last_name, date_of_birth)' });
            continue;
          }

          // Validate date format
          const dob = new Date(row.date_of_birth);
          if (isNaN(dob.getTime())) {
            errors.push({ row: rowNum, error: 'Invalid date_of_birth format' });
            continue;
          }

          // Check for duplicate MRN
          if (row.mrn) {
            const existing = await db('patients')
              .where({ clinic_id: clinicId, mrn: row.mrn })
              .first();
            if (existing) {
              skipped++;
              continue;
            }
          }

          await db('patients').insert({
            clinic_id: clinicId,
            mrn: row.mrn || null,
            first_name_encrypted: encrypt(row.first_name),
            last_name_encrypted: encrypt(row.last_name),
            date_of_birth_encrypted: encrypt(row.date_of_birth),
            guardian_name_encrypted: row.guardian_name ? encrypt(row.guardian_name) : null,
          });

          imported++;
        } catch (err) {
          errors.push({ row: rowNum, error: 'Unexpected error processing row' });
          logger.error({ err, rowNum }, 'Error importing patient row');
        }
      }

      res.json({ imported, skipped, errors });
    } catch (err) {
      next(err);
    }
  },
);

// ========================= ANALYTICS =========================

// GET /admin/analytics
adminRouter.get('/analytics', async (req, res, next) => {
  try {
    const clinicId = req.user!.clinicId;
    const period = (req.query.period as string) ?? 'week';

    const [patientCount] = await db('patients')
      .where({ clinic_id: clinicId, is_deleted: false })
      .count('* as count');

    const [sessionCount] = await db('sessions')
      .where({ clinic_id: clinicId })
      .count('* as count');

    const [tabletCount] = await db('tablets')
      .where({ clinic_id: clinicId, is_active: true })
      .count('* as count');

    const [avgDuration] = await db('sessions')
      .where({ clinic_id: clinicId, status: 'completed' })
      .avg('total_duration_ms as avg');

    const completedCount = await db('sessions')
      .where({ clinic_id: clinicId, status: 'completed' })
      .count('* as count');

    const totalCount = await db('sessions')
      .where({ clinic_id: clinicId })
      .count('* as count');

    const completionRate =
      Number(totalCount[0]?.count) > 0
        ? Number(completedCount[0]?.count) / Number(totalCount[0]?.count)
        : 0;

    // Sessions per period
    let dateTrunc: string;
    if (period === 'day') dateTrunc = 'day';
    else if (period === 'month') dateTrunc = 'month';
    else dateTrunc = 'week';

    const sessionsPerPeriod = await db('sessions')
      .where({ clinic_id: clinicId })
      .select(db.raw(`date_trunc('${dateTrunc}', started_at)::date as date`))
      .count('* as count')
      .groupByRaw(`date_trunc('${dateTrunc}', started_at)`)
      .orderByRaw(`date_trunc('${dateTrunc}', started_at)`);

    res.json({
      totalPatients: Number(patientCount?.count ?? 0),
      totalSessions: Number(sessionCount?.count ?? 0),
      activeTablets: Number(tabletCount?.count ?? 0),
      sessionsPerPeriod: sessionsPerPeriod.map((s: Record<string, unknown>) => ({
        date: new Date(s.date as string).toISOString().slice(0, 10),
        count: Number(s.count),
      })),
      avgPlayDurationMs: Number(avgDuration?.avg ?? 0),
      completionRate: Math.round(completionRate * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
});

// ========================= COPPA DATA DELETION =========================

// DELETE /admin/patients/:patientId/data
adminRouter.delete(
  '/patients/:patientId/data',
  audit({ action: 'patient.delete', resourceType: 'patient', getResourceId: (req) => req.params.patientId }),
  async (req, res, next) => {
    try {
      const patientId = req.params.patientId as string;
      const clinicId = req.user!.clinicId;

      const patient = await db('patients').where({ id: patientId, clinic_id: clinicId }).first();
      if (!patient) {
        throw new AppError(404, 'NOT_FOUND', 'Patient not found');
      }

      // Get session count for response
      const sessions = await db('sessions').where({ patient_id: patientId });
      const sessionIds = sessions.map((s: { id: string }) => s.id);

      // Delete metrics
      const metricsDeleted = await db('patient_metrics').where({ patient_id: patientId }).del();

      // Delete flags
      await db('flags').where({ patient_id: patientId }).del();

      // Delete game results
      if (sessionIds.length > 0) {
        await db('game_results').whereIn('session_id', sessionIds).del();
      }

      // Delete sessions
      await db('sessions').where({ patient_id: patientId }).del();

      // Anonymize patient record
      const deletedMarker = encrypt('[DELETED]');
      await db('patients').where({ id: patientId }).update({
        first_name_encrypted: deletedMarker,
        last_name_encrypted: deletedMarker,
        date_of_birth_encrypted: encrypt('1900-01-01'),
        guardian_name_encrypted: null,
        mrn: null,
        is_deleted: true,
        updated_at: new Date(),
      });

      res.json({
        success: true,
        sessionsDeleted: sessions.length,
        metricsDeleted,
      });
    } catch (err) {
      next(err);
    }
  },
);
