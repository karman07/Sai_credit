import { z } from 'zod';
import { ClaimType, ClaimStatus } from '../common/enums';

export const CreateClaimSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  type: z.enum(Object.values(ClaimType) as [string, ...string[]]),
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  receiptUrl: z.string().url().optional(),
});
export type CreateClaimDto = z.infer<typeof CreateClaimSchema>;

export const ReviewClaimSchema = z.object({
  status: z.enum([ClaimStatus.Approved, ClaimStatus.Rejected]),
  reviewNote: z.string().optional(),
});
export type ReviewClaimDto = z.infer<typeof ReviewClaimSchema>;
