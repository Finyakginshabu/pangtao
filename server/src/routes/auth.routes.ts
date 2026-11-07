import { Router, Request, Response, NextFunction } from 'express';
import { LoginSchema } from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { loginRateLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

router.post(
  '/login',
  loginRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = LoginSchema.parse(req.body);
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const result = await authService.login(clientIp, dto);

      const isSecure =
        process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
      const sessionTtlHours = parseInt(process.env.SESSION_TTL_HOURS || '8', 10);

      res.cookie('sid', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: sessionTtlHours * 60 * 60 * 1000,
        secure: isSecure,
      });

      res.status(200).json({ user: result.user });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/logout',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logout(req.cookies?.sid);
      res.clearCookie('sid', { path: '/' });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/me',
  requireAuth,
  (req: Request, res: Response) => {
    res.status(200).json({ user: req.user });
  }
);

export const authRouter = router;

