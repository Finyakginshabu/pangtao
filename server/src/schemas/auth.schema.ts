import { z } from 'zod';

export const LoginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email({ message: 'Invalid email address' })
    .max(254, { message: 'Email must be at most 254 characters' }),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, { message: 'Password is required' })
    .max(128, { message: 'Password must be at most 128 characters' }),
});

export type LoginDto = z.infer<typeof LoginSchema>;

