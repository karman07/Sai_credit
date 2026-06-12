import { z } from 'zod';
import { ChecklistItemStatus } from '../common/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const statusEnum = z.enum(Object.values(ChecklistItemStatus) as [string, ...string[]]);

export const CreateRTOSchema = z.object({
  caseId: objectId.optional(),
  caseCode: z.string().optional(),
  customerName: z.string().optional(),
  rtoOwnership: statusEnum.optional(),
  hypothecation: statusEnum.optional(),
  bankNoc: statusEnum.optional(),
  nocHoldAmt: z.number().min(0).optional(),
  challanClearance: statusEnum.optional(),
  aadhaarMatch: statusEnum.optional(),
  aadhaarMismatchNote: z.string().optional(),
  remarks: z.string().optional(),
});
export type CreateRTODto = z.infer<typeof CreateRTOSchema>;

export const UpdateRTOSchema = CreateRTOSchema.partial();
export type UpdateRTODto = z.infer<typeof UpdateRTOSchema>;
