import { z } from 'zod';

export const UpdateMailTemplateSchema = z.object({
  subject: z.string().min(1),
  html: z.string().min(1),
  isActive: z.boolean().optional(),
});
export type UpdateMailTemplateDto = z.infer<typeof UpdateMailTemplateSchema>;
