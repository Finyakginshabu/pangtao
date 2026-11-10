import { Router, Request, Response, NextFunction } from 'express';
import { access } from '../middleware/route-guard.middleware.js';

/**
 * Test-only fixture routes, mounted by createApp() ONLY when NODE_ENV=test
 * (never in development or production builds).
 *
 * Sprint 1 placeholders (contract f-01 v1.1): TEST-01.8 exercises role separation
 * here until the real User-only (/accounts, F-03) and Admin-only (/admin/users,
 * F-02) endpoints exist; TEST-01.11 needs a route that genuinely fails.
 */
const router = Router();

router.get('/admin-only', access('ADMIN'), (_req: Request, res: Response) => {
  res.json({ message: 'admin access granted' });
});

router.get('/user-only', access('USER'), (_req: Request, res: Response) => {
  res.json({ message: 'user access granted' });
});

// Simulates a database crash whose error carries SQL, table names, a file path and a stack.
router.get('/crash', access('public'), async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    throw new Error(
      'Invalid `prisma.session.findUnique()` invocation in C:\\srv\\pangtao\\server\\src\\middleware\\auth.middleware.ts:17:44 ' +
        '-> SELECT "public"."sessions"."token_hash" FROM "public"."sessions" WHERE "token_hash" = $1: ' +
        'relation "sessions" does not exist'
    );
  } catch (error) {
    next(error);
  }
});

export const testRouter = router;
