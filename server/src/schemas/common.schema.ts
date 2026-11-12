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
