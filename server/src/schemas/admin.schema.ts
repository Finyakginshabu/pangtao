import { z } from 'zod';

/** GET /api/v1/admin/users — limit defaults to 50, maximum 100 (contract §2.1). */
export const ListUsersQuerySchema = z.object({
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

/** Route parameter for PATCH /api/v1/admin/users/:id. Malformed ids are a 400, not a 404. */
export const UserIdSchema = z.string().uuid({ message: 'id must be a valid UUID' });

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
