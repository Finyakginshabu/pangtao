import { Router, Request, Response, NextFunction } from 'express';
import { access } from '../middleware/route-guard.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { transactionService } from '../services/transaction.service.js';
import { CreateTransactionBodySchema, ListTransactionsQuerySchema } from '../schemas/transaction.schema.js';
import { IdParamSchema } from '../schemas/common.schema.js';

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

/** GET /api/v1/transactions?limit&offset — User only (f-07 §2.1; Admin 403 per BR-02, anonymous 401). */
router.get('/', access('USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    const query = ListTransactionsQuerySchema.parse(req.query);
    res.status(200).json(await transactionService.listTransactions(req.user.id, query));
  } catch (error) {
    next(error);
  }
});

/** GET /api/v1/transactions/:id — User only; another user's id is 404 (f-07 §2.1, D-03). */
router.get('/:id', access('USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    const id = IdParamSchema.parse(req.params.id);
    const transaction = await transactionService.getTransaction(req.user.id, id);
    res.status(200).json({ transaction });
  } catch (error) {
    next(error);
  }
});

export const transactionsRouter = router;
