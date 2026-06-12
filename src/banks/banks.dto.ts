import { z } from 'zod';

export const CreateBankSchema = z.object({
  name: z.string().min(1),
  branch: z.string().optional(),
  bmName: z.string().optional(),
  bmContact: z.string().optional(),
  executive: z.string().optional(),
  logoUrl: z.string().url().optional(),
});
export type CreateBankDto = z.infer<typeof CreateBankSchema>;

export const UpdateBankSchema = CreateBankSchema.partial();
export type UpdateBankDto = z.infer<typeof UpdateBankSchema>;
