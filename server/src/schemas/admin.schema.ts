import { z } from 'zod';
import { IdParamSchema, PaginationQuerySchema } from './common.schema.js';

/** GET /api/v1/admin/users — limit defaults to 50, maximum 100 (contract §2.1). */
export const ListUsersQuerySchema = PaginationQuerySchema;

/** Route parameter for PATCH /api/v1/admin/users/:id. */
export const UserIdSchema = IdParamSchema;

/** PATCH /api/v1/admin/users/:id — strictly { isActive: boolean } (contract §1). */
export const UpdateUserStatusSchema = z
  .object({
    isActive: z.boolean({
      required_error: 'isActive is required',
      invalid_type_error: 'isActive must be a boolean',
    }),
  })
  .strict();

export type ListUsersQueryDto = z.infer<typeof ListUsersQuerySchema>;
export type UpdateUserStatusDto = z.infer<typeof UpdateUserStatusSchema>;
