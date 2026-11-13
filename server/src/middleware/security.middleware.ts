import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from './error.middleware.js';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

const MUTATING_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

function hasBody(req: Request): boolean {
  const length = req.headers['content-length'];
  return req.headers['transfer-encoding'] !== undefined || (length !== undefined && Number(length) > 0);
}

function isJson(contentType: string | undefined): boolean {
  return contentType?.split(';')[0].trim().toLowerCase() === 'application/json';
}

/**
 * NFR-10 / AC-01.13 for state-changing requests:
 *  - any request body must be declared `application/json` (missing or other type → 415);
 *  - a declared non-JSON Content-Type is rejected even without a body (415);
 *  - an `Origin` header is required and must match the host (missing/mismatched → 403).
 * Browsers always send Origin on POST/PATCH/PUT/DELETE, so legitimate clients are unaffected.
 */
export function securityGuard(req: Request, _res: Response, next: NextFunction) {
  if (MUTATING_METHODS.includes(req.method)) {
    const contentType = req.headers['content-type'];

    if ((hasBody(req) || contentType !== undefined) && !isJson(contentType)) {
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

    if (!origin || !host) {
      return next(new AppError(403, 'FORBIDDEN', 'Missing request origin (CSRF protection)'));
    }

    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      return next(new AppError(403, 'FORBIDDEN', 'Invalid request origin'));
    }

    // In local development, allow localhost/127.0.0.1 on dev ports (e.g. Vite on 3000 -> API on 8080)
    const hostWithoutPort = host.split(':')[0];
    const isLocalDev =
      process.env.NODE_ENV !== 'production' &&
      (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') &&
      (hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1');

    if (originUrl.host !== host && !isLocalDev) {
      return next(new AppError(403, 'FORBIDDEN', 'Cross-origin request rejected (CSRF protection)'));
    }
  }

  next();
}
