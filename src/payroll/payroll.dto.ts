import { z } from 'zod';
import { PayrollStatus } from '../common/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const IncentiveSchema = z.object({
  reason: z.string().min(1),
  amount: z.number().min(0),
});

const DeductionSchema = z.object({
  reason: z.string().min(1),
  amount: z.number().min(0),
});

export const GeneratePayrollSchema = z.object({
  userId: objectId,
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  workingDaysInMonth: z.number().int().min(1).max(31).optional(),
  remarks: z.string().optional(),
});
export type GeneratePayrollDto = z.infer<typeof GeneratePayrollSchema>;

export const UpdatePayrollSchema = z.object({
  basicSalary: z.number().min(0).optional(),
  workingDaysInMonth: z.number().int().min(1).max(31).optional(),
  presentDays: z.number().int().min(0).optional(),
  halfDays: z.number().int().min(0).optional(),
  absentDays: z.number().int().min(0).optional(),
  leaveDays: z.number().int().min(0).optional(),
  paidLeaveDays: z.number().int().min(0).optional(),
  lwpDays: z.number().int().min(0).optional(),
  incentives: z.array(IncentiveSchema).optional(),
  additionalDeductions: z.array(DeductionSchema).optional(),
  reimbursementTotal: z.number().min(0).optional(),
  lopDeduction: z.number().min(0).optional(),
  status: z.enum(Object.values(PayrollStatus) as [string, ...string[]]).optional(),
  paidAt: z.string().optional(),
  remarks: z.string().optional(),
});
export type UpdatePayrollDto = z.infer<typeof UpdatePayrollSchema>;
