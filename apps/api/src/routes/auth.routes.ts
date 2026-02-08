import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authenticateTemp } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';

export const authRouter: IRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const mfaVerifySchema = z.object({
  tempToken: z.string().min(1),
  totpCode: z.string().length(6),
});

const tabletVerifySchema = z.object({
  pin: z.string().min(4).max(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.loginWithEmail(req.body.email, req.body.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/mfa/verify', validate(mfaVerifySchema), async (req, res, next) => {
  try {
    const result = await authService.verifyMfa(req.body.tempToken, req.body.totpCode);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/mfa/setup', authenticate, async (req, res, next) => {
  try {
    const result = await authService.setupMfa(req.user!.sub);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/tablet/verify', async (req, res, next) => {
  try {
    const deviceToken = req.headers['x-device-token'] as string;
    if (!deviceToken) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing device token' } });
      return;
    }
    const parsed = tabletVerifySchema.parse(req.body);
    const result = await authService.verifyTabletPin(deviceToken, parsed.pin);
    res.json({
      accessToken: result.accessToken,
      staffName: result.staffName,
      clinicName: result.clinicName,
      tabletId: result.tabletId,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await authService.refreshTokens(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
