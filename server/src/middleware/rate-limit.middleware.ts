import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware.js';

interface AttemptRecord {
  count: number;
  resetAt: number;
}

const attemptStore = new Map<string, AttemptRecord>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

export function recordFailedLogin(ip: string, email: string): void {
  const key = `${ip}:${email.trim().toLowerCase()}`;
  const now = Date.now();
  const existing = attemptStore.get(key);

  if (!existing || existing.resetAt <= now) {
    attemptStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    existing.count += 1;
  }
}

export function resetFailedLogin(ip: string, email: string): void {
  const key = `${ip}:${email.trim().toLowerCase()}`;
  attemptStore.delete(key);
}

export function clearRateLimitStore(): void {
  attemptStore.clear();
}

export function loginRateLimiter(req: Request, _res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const email = (req.body?.email as string) || '';
  const key = `${ip}:${email.trim().toLowerCase()}`;

  const now = Date.now();
  const record = attemptStore.get(key);

  if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
    return next(
      new AppError(
        429,
        'RATE_LIMITED',
        'Too many failed login attempts. Please try again in 15 minutes.'
      )
    );
  }

  next();
}

