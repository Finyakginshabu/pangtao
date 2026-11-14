import { prisma } from '../prisma.js';

/** AC-01.12: at most 10 failed logins per 15 minutes per client IP + email. */
export const MAX_FAILED_LOGINS = 10;
export const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * Failed-login counter kept in the `login_attempts` table, so the limit holds across a
 * restart and across several Cloud Run instances (Lab 5 R-04). Callers pass the email
 * already trimmed and lower-cased.
 */
export class LoginAttemptService {
  async isBlocked(ip: string, email: string): Promise<boolean> {
    const blocked = await prisma.loginAttempt.count({
      where: { ip, email, count: { gte: MAX_FAILED_LOGINS }, resetAt: { gt: new Date() } },
    });
    return blocked > 0;
  }

  async recordFailure(ip: string, email: string): Promise<void> {
    const now = new Date();
    await prisma.$transaction([
      // Expired windows start over; this also clears stale rows for other clients.
      prisma.loginAttempt.deleteMany({ where: { resetAt: { lte: now } } }),
      // Unique-key upsert runs as one INSERT … ON CONFLICT, so concurrent failures on
      // different instances each add exactly one to the count.
      prisma.loginAttempt.upsert({
        where: { ip_email: { ip, email } },
        create: { ip, email, count: 1, resetAt: new Date(now.getTime() + FAILED_LOGIN_WINDOW_MS) },
        update: { count: { increment: 1 } },
      }),
    ]);
  }

  /** A successful login clears the count for that client IP + email. */
  async reset(ip: string, email: string): Promise<void> {
    await prisma.loginAttempt.deleteMany({ where: { ip, email } });
  }

  /** Test support: forget every recorded failure. */
  async clearAll(): Promise<void> {
    await prisma.loginAttempt.deleteMany();
  }
}

export const loginAttemptService = new LoginAttemptService();
