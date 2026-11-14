import { Router, Request, Response, NextFunction, CookieOptions } from 'express';
import { LoginSchema } from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';
import { access } from '../middleware/route-guard.middleware.js';
import { clientIp, loginRateLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

/** Attributes shared by issuing and clearing the `sid` cookie, so the clear always matches. */
function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  };
}

router.post(
  '/login',
  access('public'),
  loginRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = LoginSchema.parse(req.body);
      const ip = clientIp(req);
      const result = await authService.login(ip, dto);

      const sessionTtlHours = parseInt(process.env.SESSION_TTL_HOURS || '8', 10);
      res.cookie('sid', result.token, {
        ...sessionCookieOptions(),
        maxAge: sessionTtlHours * 60 * 60 * 1000,
      });

      res.status(200).json({ user: result.user });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/logout',
  access('authenticated'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logout(req.cookies?.sid);
      // AC-01.5: explicit Max-Age=0 (not only a 1970 Expires) with the same attributes as login.
      res.cookie('sid', '', { ...sessionCookieOptions(), maxAge: 0 });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.get('/me', access('authenticated'), (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});

export const authRouter = router;
