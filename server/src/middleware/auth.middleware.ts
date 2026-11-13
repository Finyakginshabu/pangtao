import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../prisma.js';
import { hashSessionToken } from '../utils/hash.util.js';
import { AppError } from './error.middleware.js';

export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.sid;

  if (!token || typeof token !== 'string') {
    req.user = null;
    return next();
  }

  try {
    const tokenHash = hashSessionToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      req.user = null;
      return next();
    }

    // Check session expiration
    if (session.expiresAt <= new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      req.user = null;
      return next();
    }

    // Check if user is active
    if (!session.user.isActive) {
      req.user = null;
      return next();
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      role: session.user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  }
  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource'));
    }

    next();
  };
}

