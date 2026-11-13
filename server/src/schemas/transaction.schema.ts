import { z } from 'zod';
import { IdParamSchema, PositiveSatangSchema } from './common.schema.js';
import { isRealCalendarDate } from '../utils/date.util.js';

const AllocationLineSchema = z
  .object({
    targetAccountId: IdParamSchema,
    amount: PositiveSatangSchema,
    note: z.string().optional(),
  })
  .strict();

/**
 * POST /api/v1/transactions (f-05 §2.1). Only `PAYMENT` exists until F-06 adds `RECEIPT`.
 * Amounts follow BR-04, and there must be at least one line (BR-05). The future-date rule
 * needs "today", so it lives in the service.
 */
export const CreateTransactionBodySchema = z
  .object({
    kind: z.literal('PAYMENT'),
    accountId: IdParamSchema,
    txnDate: z
      .string({ required_error: 'txnDate is required', invalid_type_error: 'txnDate must be a string' })
      .refine(isRealCalendarDate, { message: 'txnDate must be a valid calendar date in YYYY-MM-DD format' }),
    totalAmount: PositiveSatangSchema,
    memo: z.string().optional(),
    lines: z.array(AllocationLineSchema).min(1, { message: 'at least one allocation line is required' }),
  })
  .strict();

export type CreateTransactionBodyDto = z.infer<typeof CreateTransactionBodySchema>;
