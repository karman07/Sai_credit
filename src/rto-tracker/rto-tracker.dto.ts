import { z } from 'zod';
import { ChecklistItemStatus } from '../common/enums';
import { RTOOwnershipType } from './schemas/rto-tracker.schema';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const checklistStatus = z.enum(Object.values(ChecklistItemStatus) as [string, ...string[]]);
const stageStatus = z.enum(['Pending', 'Done']);

export const CreateRTOSchema = z.object({
  caseId: objectId.optional(),
  caseCode: z.string().optional(),
  customerName: z.string().optional(),

  rtoOwnershipType: z.enum(Object.values(RTOOwnershipType) as [string, ...string[]]).optional(),
  rtoOwnership: checklistStatus.optional(),
  rtoReceiving: z.boolean().optional(),
  challanCheck: checklistStatus.optional(),
  bankNocCheck: checklistStatus.optional(),
  nocHoldAmt: z.number().min(0).optional(),
  insuranceCheck: checklistStatus.optional(),
  hypothecation: checklistStatus.optional(),
  aadhaarMatch: checklistStatus.optional(),
  aadhaarMismatchNote: z.string().optional(),

  pendingDocuments: z.array(z.string()).optional(),
  rtoSlipUrl: z.string().optional(),
  rtoSlipFileName: z.string().optional(),

  verification: stageStatus.optional(),
  approval: stageStatus.optional(),
  approvalDate: z.string().optional(),

  insuranceEndorsement: stageStatus.optional(),
  balancePayment: z.number().min(0).optional(),

  remarks: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});
export type CreateRTODto = z.infer<typeof CreateRTOSchema>;

export const UpdateRTOSchema = CreateRTOSchema.partial();
export type UpdateRTODto = z.infer<typeof UpdateRTOSchema>;
