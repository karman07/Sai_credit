import { z } from 'zod';
import { LeaveType, LeaveStatus } from '../common/enums';

export const CreateLeaveSchema = z.object({
  type:      z.enum(Object.values(LeaveType) as [string, ...string[]]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason:    z.string().min(5, 'Reason must be at least 5 characters'),
});
export type CreateLeaveDto = z.infer<typeof CreateLeaveSchema>;

export const ReviewLeaveSchema = z.object({
  status:     z.enum([LeaveStatus.Approved, LeaveStatus.Rejected]),
  reviewNote: z.string().optional(),
});
export type ReviewLeaveDto = z.infer<typeof ReviewLeaveSchema>;
