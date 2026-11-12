import { z } from 'zod';

/**
 * Shared route parameter for endpoints addressed by a UUID id (e.g. `/accounts/:id/...`).
 * Malformed ids are a 400, not a 404.
 */
export const IdParamSchema = z.string().uuid({ message: 'id must be a valid UUID' });
