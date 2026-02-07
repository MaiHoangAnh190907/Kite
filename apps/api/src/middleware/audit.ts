import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/connection.js';
import { logger } from '../config/logger.js';

export type AuditAction =
  | 'patient.view'
  | 'patient.create'
  | 'patient.delete'
  | 'session.create'
  | 'metrics.view'
  | 'flag.dismiss'
  | 'staff.create'
  | 'staff.delete'
  | 'staff.update'
  | 'tablet.create'
  | 'patient.import';

interface AuditOptions {
  action: AuditAction;
  resourceType: string;
  getResourceId?: (req: Request) => string | string[] | undefined;
}

export function audit(options: AuditOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Write audit log asynchronously — don't block the response
    setImmediate(() => {
      const rawId = options.getResourceId?.(req) ?? req.params.id ?? req.params.patientId;
      const resourceId = Array.isArray(rawId) ? rawId[0] : rawId;
      db('audit_log')
        .insert({
          user_id: req.user?.sub ?? null,
          clinic_id: req.user?.clinicId ?? null,
          action: options.action,
          resource_type: options.resourceType,
          resource_id: resourceId ?? null,
          ip_address: req.ip ?? null,
          user_agent: req.headers['user-agent'] ?? null,
          details: null,
        })
        .catch((err: unknown) => {
          logger.error({ err, action: options.action }, 'Failed to write audit log');
        });
    });
    next();
  };
}

export async function writeAuditLog(
  userId: string | null,
  clinicId: string | null,
  action: AuditAction,
  resourceType: string,
  resourceId: string | null,
  ip?: string | null,
  userAgent?: string | null,
): Promise<void> {
  try {
    await db('audit_log').insert({
      user_id: userId,
      clinic_id: clinicId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      ip_address: ip ?? null,
      user_agent: userAgent ?? null,
    });
  } catch (err) {
    logger.error({ err, action }, 'Failed to write audit log');
  }
}
