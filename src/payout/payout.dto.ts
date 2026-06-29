import { z } from 'zod';
import { InvoiceStatus, PayoutStatus } from '../common/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const LinkedCaseSchema = z.object({
  caseId: objectId,
  caseCode: z.string(),
  customerName: z.string().optional(),
  loanAmount: z.number().optional(),
});

export const CreatePayoutSchema = z.object({
  businessMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  invoiceDate: z.string().optional(),
  bankId: objectId.optional(),
  bankName: z.string().optional(),
  company: z.string().optional(),
  volumeCases: z.number().int().min(0).optional(),
  linkedCases: z.array(LinkedCaseSchema).optional(),
  invoiceStatus: z.enum(Object.values(InvoiceStatus) as [string, ...string[]]).optional(),
  invoiceNumber: z.string().optional(),
  invoiceAmount: z.number().min(0).optional(),
  commission: z.number().min(0).optional(),
  cgstAmount: z.number().min(0).optional(),
  sgstAmount: z.number().min(0).optional(),
  gstAmount: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  payoutStatus: z.enum(Object.values(PayoutStatus) as [string, ...string[]]).optional(),
  payoutDate: z.string().optional(),
  remarks: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});
export type CreatePayoutDto = z.infer<typeof CreatePayoutSchema>;

export const UpdatePayoutSchema = CreatePayoutSchema.partial();
export type UpdatePayoutDto = z.infer<typeof UpdatePayoutSchema>;
