import type { Express, NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from './auth.middleware.js';

/**
 * Default-deny routing (NFR-02, AC-01.7).
 *
 * Every route must declare its access level by using `access(level)` as its FIRST
 * handler, and every router must be mounted with `mountRouter()`. `createApp()`
 * calls `assertRoutesGuarded()` after mounting, which walks Express's actual
 * route table and throws (so the server never starts) if any route lacks a
 * declaration. Declaration and enforcement are the same middleware, so they
 * cannot drift apart.
 */
export type RouteAccessLevel = 'public' | 'authenticated' | 'USER' | 'ADMIN';

export interface RouteDeclaration {
  method: string;
  path: string;
  access: RouteAccessLevel;
}

const ACCESS = Symbol.for('pangtao.routeAccess');
const MOUNT_PATH = Symbol.for('pangtao.mountPath');
const DECLARED_ROUTES = Symbol.for('pangtao.declaredRoutes');

type TaggedHandler = RequestHandler & { [ACCESS]?: RouteAccessLevel };

const allowAnyone: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => next();

const GUARDS: Record<RouteAccessLevel, RequestHandler> = {
  public: allowAnyone,
  authenticated: requireAuth,
  USER: requireRole(Role.USER),
  ADMIN: requireRole(Role.ADMIN),
};

/** Declares and enforces a route's access level. Must be the route's first handler. */
export function access(level: RouteAccessLevel): RequestHandler {
  const guard = GUARDS[level];
  const tagged: TaggedHandler = (req, res, next) => guard(req, res, next);
  tagged[ACCESS] = level;
  return tagged;
}

/** Mounts a router and records its prefix so the startup check can report full paths. */
export function mountRouter(app: Express, prefix: string, router: Router): void {
  (router as unknown as Record<symbol, string>)[MOUNT_PATH] = prefix;
  app.use(prefix, router);
}

interface ExpressLayer {
  name?: string;
  method?: string;
  handle?: { stack?: ExpressLayer[]; [key: symbol]: unknown } & TaggedHandler;
  route?: { path: string | RegExp; methods: Record<string, boolean>; stack: ExpressLayer[] };
}

function walk(stack: ExpressLayer[], prefix: string, routes: RouteDeclaration[], violations: string[]): void {
  for (const layer of stack) {
    if (layer.route) {
      const routePath = `${prefix}${String(layer.route.path)}`;
      const methods = Object.keys(layer.route.methods).filter((m) => layer.route!.methods[m]);
      for (const method of methods) {
        const first = layer.route.stack.find((l) => l.method === method || l.method === undefined);
        const level = first?.handle?.[ACCESS];
        if (!level) {
          violations.push(`${method.toUpperCase()} ${routePath}`);
        } else {
          routes.push({ method: method.toUpperCase(), path: routePath, access: level });
        }
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const mount = layer.handle[MOUNT_PATH];
      if (typeof mount !== 'string') {
        violations.push(`router mounted under "${prefix || '/'}" without mountRouter()`);
        continue;
      }
      walk(layer.handle.stack, `${prefix}${mount}`, routes, violations);
    }
  }
}

/**
 * Verifies every mounted route declares its access level. Throws on the first
 * violation set so app creation (and therefore server startup) fails.
 */
export function assertRoutesGuarded(app: Express): RouteDeclaration[] {
  const stack = ((app as unknown as { _router?: { stack: ExpressLayer[] } })._router?.stack ?? []);
  const routes: RouteDeclaration[] = [];
  const violations: string[] = [];
  walk(stack, '', routes, violations);
  if (violations.length > 0) {
    throw new Error(
      `[NFR-02 Violation] Routes without a declared access guard (first handler must be access(...)): ${violations.join(', ')}`
    );
  }
  (app as unknown as Record<symbol, RouteDeclaration[]>)[DECLARED_ROUTES] = routes;
  return routes;
}

/** Routes verified by `assertRoutesGuarded` for this app (used by the NFR-02 route-list test). */
export function getDeclaredRoutes(app: Express): RouteDeclaration[] {
  return [...((app as unknown as Record<symbol, RouteDeclaration[] | undefined>)[DECLARED_ROUTES] ?? [])];
}
