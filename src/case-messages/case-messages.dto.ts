import { z } from 'zod';

const AttachmentSchema = z.object({
  url: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().optional(),
});

export const SendCaseMessageSchema = z
  .object({
    text: z.string().optional().default(''),
    attachments: z.array(AttachmentSchema).optional().default([]),
  })
  .refine((d) => d.text.trim().length > 0 || d.attachments.length > 0, {
    message: 'Message must have text or at least one attachment',
  });
export type SendCaseMessageDto = z.infer<typeof SendCaseMessageSchema>;
