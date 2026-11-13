import { Router, Request, Response, NextFunction } from 'express';
import { access } from '../middleware/route-guard.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { summaryService } from '../services/summary.service.js';
import { SummaryQuerySchema } from '../schemas/summary.schema.js';

const router = Router();

/** GET /api/v1/summary/income-expense — User only (f-08 §2.1; Admin 403 per BR-02, anonymous 401). */
router.get('/income-expense', access('USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    const query = SummaryQuerySchema.parse(req.query);
    res.status(200).json(await summaryService.getIncomeExpense(req.user.id, query));
  } catch (error) {
    next(error);
  }
});

export const summaryRouter = router;
