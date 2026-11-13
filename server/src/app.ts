import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware, securityGuard } from './middleware/security.middleware.js';
import { sessionMiddleware } from './middleware/auth.middleware.js';
import { errorHandler, AppError } from './middleware/error.middleware.js';
import { access, assertRoutesGuarded, mountRouter } from './middleware/route-guard.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { accountsRouter } from './routes/accounts.routes.js';
import { transactionsRouter } from './routes/transactions.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { testRouter } from './routes/test.routes.js';

export interface AppOptions {
  /** Mount /api/v1/test/* fixtures. Default: only when NODE_ENV=test. */
  enableTestRoutes?: boolean;
  /** Directory of the built web app to serve. Default: web/dist in production when built; null disables. */
  webDistDir?: string | null;
}

// server/src (tsx, vitest) and server/dist (build) are both two levels below the repo root.
const BUILT_WEB_DIR = path.resolve(__dirname, '..', '..', 'web', 'dist');

function defaultWebDistDir(): string | null {
  const isBuilt = fs.existsSync(path.join(BUILT_WEB_DIR, 'index.html'));
  return process.env.NODE_ENV === 'production' && isBuilt ? BUILT_WEB_DIR : null;
}

const notFound = (_req: Request, _res: Response, next: NextFunction) =>
  next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found'));

export function createApp(options: AppOptions = {}) {
  const enableTestRoutes = options.enableTestRoutes ?? process.env.NODE_ENV === 'test';
  const webDistDir = options.webDistDir === undefined ? defaultWebDistDir() : options.webDistDir;

  const app = express();

  // Request tracking first so every response (including rejections) carries X-Request-Id.
  app.use(requestIdMiddleware);
  // CSRF / content-type checks before any body parsing (NFR-10).
  app.use(securityGuard);
  app.use(cookieParser());
  app.use(express.json());

  // Built SPA assets are static files; serve them before the per-request session lookup.
  if (webDistDir) {
    app.use(express.static(webDistDir, { index: false }));
  }

  app.use(sessionMiddleware);

  // API routers: every route declares access(...) as its first handler (NFR-02).
  mountRouter(app, '/api/v1', healthRouter);
  mountRouter(app, '/api/v1/auth', authRouter);
  mountRouter(app, '/api/v1/admin', adminRouter);
  mountRouter(app, '/api/v1/accounts', accountsRouter);
  mountRouter(app, '/api/v1/transactions', transactionsRouter);
  if (enableTestRoutes) {
    mountRouter(app, '/api/v1/test', testRouter);
  }

  // Unknown API paths stay JSON 404s and never fall through to the SPA.
  app.use('/api', notFound);

  // Production: the backend also serves the built React app (system-sds §1), with an
  // index.html fallback so client-side routes like /transactions survive a reload.
  if (webDistDir) {
    app.get('*', access('public'), (_req: Request, res: Response) => {
      res.sendFile(path.join(webDistDir, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  // Default deny: refuse to build (and therefore to start) with any undeclared route.
  assertRoutesGuarded(app);

  return app;
}

export const app = createApp();
