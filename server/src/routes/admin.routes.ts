import { Router, Request, Response, NextFunction } from 'express';
import { access } from '../middleware/route-guard.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { adminService } from '../services/admin.service.js';
import {
  ListUsersQuerySchema,
  UpdateUserStatusSchema,
  UserIdSchema,
} from '../schemas/admin.schema.js';

const router = Router();

/** GET /api/v1/admin/users?limit&offset — Administrator only. */
router.get('/users', access('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ListUsersQuerySchema.parse(req.query);
    const result = await adminService.listUsers(query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/v1/admin/users/:id — Administrator only. */
router.patch('/users/:id', access('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = UserIdSchema.parse(req.params.id);
    const dto = UpdateUserStatusSchema.parse(req.body);

    const actor = req.user;
    if (!actor) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const user = await adminService.updateUserStatus(targetUserId, dto.isActive, actor.id);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

export const adminRouter = router;
