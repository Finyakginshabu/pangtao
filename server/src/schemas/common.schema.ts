import { z } from 'zod';

/**
 * Shared route parameter for endpoints addressed by a UUID id (e.g. `/accounts/:id/...`).
 * Malformed ids are a 400, not a 404.
 */
export const IdParamSchema = z.string().uuid({ message: 'id must be a valid UUID' });

/** BR-04: a transaction or line amount, positive integer satang up to 100,000,000.00 THB. */
export const PositiveSatangSchema = z
  .number({ required_error: 'amount is required', invalid_type_error: 'amount must be an integer number of satang' })
  .int({ message: 'amount must be an integer number of satang' })
  .positive({ message: 'amount must be greater than 0' })
  .max(10_000_000_000, { message: 'amount must be at most 100,000,000.00 THB' });

/** `?limit&offset` for paginated lists: limit 1–100 (default 50), offset ≥ 0 (default 0). */
export const PaginationQuerySchema = z.object({
  limit: z.coerce
    .number({ invalid_type_error: 'limit must be a number' })
    .int({ message: 'limit must be an integer' })
    .min(1, { message: 'limit must be at least 1' })
    .max(100, { message: 'limit must be at most 100' })
    .default(50),
  offset: z.coerce
    .number({ invalid_type_error: 'offset must be a number' })
    .int({ message: 'offset must be an integer' })
    .min(0, { message: 'offset must be at least 0' })
    .default(0),
});
