import { Router, Request, Response, NextFunction } from 'express';
import { access } from '../middleware/route-guard.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { transactionService } from '../services/transaction.service.js';
import { CreateTransactionBodySchema } from '../schemas/transaction.schema.js';

const router = Router();

/** POST /api/v1/transactions — User only (f-05 §2.1; Admin 403 per BR-02, anonymous 401). */
router.post('/', access('USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    const dto = CreateTransactionBodySchema.parse(req.body);
    const transaction = await transactionService.createTransaction(dto, req.user.id);
    res.status(201).json({ transaction });
  } catch (error) {
    next(error);
  }
});

export const transactionsRouter = router;
