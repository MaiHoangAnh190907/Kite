import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-device-token"]',
      'body.password',
      'body.pin',
      'body.totpCode',
      'body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
});
