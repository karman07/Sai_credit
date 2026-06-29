import { z } from 'zod';
import { AttendanceStatus } from '../common/enums';

export const ClockInSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional(),
  note: z.string().optional(),
});
export type ClockInDto = z.infer<typeof ClockInSchema>;

export const ClockOutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional(),
  note: z.string().optional(),
});
export type ClockOutDto = z.infer<typeof ClockOutSchema>;

export const AdminMarkAttendanceSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  status: z.enum(Object.values(AttendanceStatus) as [string, ...string[]]),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  note: z.string().optional(),
});
export type AdminMarkAttendanceDto = z.infer<typeof AdminMarkAttendanceSchema>;

export const UpdateAttendanceSchema = z.object({
  status: z.enum(Object.values(AttendanceStatus) as [string, ...string[]]).optional(),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  note: z.string().optional(),
});
export type UpdateAttendanceDto = z.infer<typeof UpdateAttendanceSchema>;
