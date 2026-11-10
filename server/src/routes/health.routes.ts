import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { access } from '../middleware/route-guard.middleware.js';

const router = Router();

router.get('/health', access('public'), async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[health] DB connectivity check failed:', error);
    res.status(503).json({ status: 'degraded' });
  }
});

export const healthRouter = router;

