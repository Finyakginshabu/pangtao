import { z } from 'zod';
import { IdParamSchema, PaginationQuerySchema, PositiveSatangSchema } from './common.schema.js';
import { isRealCalendarDate } from '../utils/date.util.js';

const AllocationLineSchema = z
  .object({
    targetAccountId: IdParamSchema,
    amount: PositiveSatangSchema,
    note: z.string().optional(),
  })
  .strict();

/**
 * POST /api/v1/transactions (f-05 §2.1, f-06 §2.1): one body for both forms, discriminated
 * by `kind`. Amounts follow BR-04, and there must be at least one line (BR-05). The
 * form-specific source/target matrix and the future-date rule need database or "today"
 * state, so they live in the service.
 */
const TransactionFieldsSchema = z.object({
  accountId: IdParamSchema,
  txnDate: z
    .string({ required_error: 'txnDate is required', invalid_type_error: 'txnDate must be a string' })
    .refine(isRealCalendarDate, { message: 'txnDate must be a valid calendar date in YYYY-MM-DD format' }),
  totalAmount: PositiveSatangSchema,
  memo: z.string().optional(),
  lines: z.array(AllocationLineSchema).min(1, { message: 'at least one allocation line is required' }),
});

const PaymentBodySchema = TransactionFieldsSchema.extend({ kind: z.literal('PAYMENT') }).strict();
const ReceiptBodySchema = TransactionFieldsSchema.extend({ kind: z.literal('RECEIPT') }).strict();

export const CreateTransactionBodySchema = z.discriminatedUnion('kind', [
  PaymentBodySchema,
  ReceiptBodySchema,
]);

export type CreateTransactionBodyDto = z.infer<typeof CreateTransactionBodySchema>;

/** GET /api/v1/transactions?limit&offset (f-07 §1): limit 1–100 (default 50), offset ≥ 0. */
export const ListTransactionsQuerySchema = PaginationQuerySchema;

export type ListTransactionsQueryDto = z.infer<typeof ListTransactionsQuerySchema>;
