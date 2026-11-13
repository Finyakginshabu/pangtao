import { z } from 'zod';
import { isRealCalendarDate } from '../utils/date.util.js';

const CalendarDateSchema = z
  .string({ invalid_type_error: 'date must be a string' })
  .refine(isRealCalendarDate, {
    message: 'must be a valid calendar date in YYYY-MM-DD format',
  });

/**
 * GET /api/v1/summary/income-expense?from&to (f-08 §2.1). Both bounds are optional;
 * the service fills an omitted bound from the current Bangkok month (AC-08.8).
 * `from > to` is checked in the service, after the defaults are applied.
 */
export const SummaryQuerySchema = z
  .object({
    from: CalendarDateSchema.optional(),
    to: CalendarDateSchema.optional(),
  })
  .strict();

export type SummaryQueryDto = z.infer<typeof SummaryQuerySchema>;
