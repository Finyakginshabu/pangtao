import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from './error.middleware.js';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

export function securityGuard(req: Request, _res: Response, next: NextFunction) {
  const mutatingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];

  if (mutatingMethods.includes(req.method)) {
    const contentType = req.headers['content-type'];

    // If request contains a payload or specifies content-type, it must be application/json
    if (contentType && !contentType.toLowerCase().includes('application/json')) {
      return next(
        new AppError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Content-Type must be application/json for state-mutating requests'
        )
      );
    }

    // CSRF Origin verification
    const origin = req.headers['origin'];
    const host = req.headers['host'];

    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        const hostWithoutPort = host.split(':')[0];

        // In local development, allow localhost/127.0.0.1 on dev ports (e.g. Vite on 3000 -> API on 8080)
        const isLocalDev =
          process.env.NODE_ENV !== 'production' &&
          (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') &&
          (hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1');

        if (originUrl.host !== host && !isLocalDev) {
          return next(
            new AppError(403, 'FORBIDDEN', 'Cross-origin request rejected (CSRF protection)')
          );
        }
      } catch {
        return next(
          new AppError(403, 'FORBIDDEN', 'Invalid request origin')
        );
      }
    }
  }

  next();
}
