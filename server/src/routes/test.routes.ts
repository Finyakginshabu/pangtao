import { Router, Request, Response, NextFunction } from 'express';
import { access } from '../middleware/route-guard.middleware.js';

/**
 * Test-only fixture routes, mounted by createApp() ONLY when NODE_ENV=test
 * (never in development or production builds).
 *
 * TEST-01.11 needs a route that genuinely fails. /admin-only and /user-only were the
 * contract f-01 v1.1 placeholders for TEST-01.8, which now targets the real
 * /admin/users (F-02) and /accounts (F-03); they stay as minimal fixtures for the
 * "not mounted outside NODE_ENV=test" deployment check.
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
