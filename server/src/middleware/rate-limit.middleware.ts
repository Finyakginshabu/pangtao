import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware.js';
import { loginAttemptService } from '../services/login-attempt.service.js';

/** Client address used in the AC-01.12 key. Behind Cloud Run, `trust proxy` makes this the real client. */
export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/** Test support: forget every recorded failed login. */
export function clearRateLimitStore(): Promise<void> {
  return loginAttemptService.clearAll();
}

/** AC-01.12: reject a login once its client IP + email has 10 failures in the current 15-minute window. */
export async function loginRateLimiter(req: Request, _res: Response, next: NextFunction) {
  const rawEmail: unknown = req.body?.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  try {
    if (await loginAttemptService.isBlocked(clientIp(req), email)) {
      return next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many failed login attempts. Please try again in 15 minutes.'
        )
      );
    }
    next();
  } catch (error) {
    next(error);
  }
}
