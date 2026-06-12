import { z } from 'zod';
import { Portal } from '../common/enums';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  portal: z.nativeEnum(Portal).default(Portal.Admin),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshDto = z.infer<typeof RefreshSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
