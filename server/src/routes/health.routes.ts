import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[health] DB connectivity check failed:', error);
    res.status(503).json({ status: 'degraded' });
  }
});

export const healthRouter = router;

