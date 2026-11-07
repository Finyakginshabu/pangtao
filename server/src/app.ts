import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware, securityGuard } from './middleware/security.middleware.js';
import { sessionMiddleware, requireRole } from './middleware/auth.middleware.js';
import { errorHandler, AppError } from './middleware/error.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { RouteRegistry } from './middleware/route-guard.middleware.js';
import { Role } from '@prisma/client';

export function createApp() {
  const app = express();

  // Basic middleware
  app.use(cookieParser());
  app.use(express.json());

  // Security & Request tracking
  app.use(requestIdMiddleware);
  app.use(securityGuard);

  // Session verification on all requests
  app.use(sessionMiddleware);

  // Register public and protected routes
  RouteRegistry.register('GET', '/api/v1/health', 'public');
  RouteRegistry.register('POST', '/api/v1/auth/login', 'public');
  RouteRegistry.register('POST', '/api/v1/auth/logout', 'authenticated');
  RouteRegistry.register('GET', '/api/v1/auth/me', 'authenticated');

  // Test routes for role verification (TEST-01.8)
  app.get('/api/v1/test/admin-only', requireRole(Role.ADMIN), (_req: Request, res: Response) => {
    res.json({ message: 'admin access granted' });
  });
  app.get('/api/v1/test/user-only', requireRole(Role.USER), (_req: Request, res: Response) => {
    res.json({ message: 'user access granted' });
  });

  // Mount API routers
  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);

  // 404 Handler
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found'));
  });

  // Centralized Error Envelope
  app.use(errorHandler);

  return app;
}

export const app = createApp();
