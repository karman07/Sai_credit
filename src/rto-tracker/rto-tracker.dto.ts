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
  status: z.string().min(1).optional(),

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

export const UpdateStageSchema = z.object({
  status: z.enum(['Pending', 'In Progress', 'Done', 'NA']).optional(),
  comment: z.string().trim().min(1).optional(),
}).refine((d) => d.status !== undefined || d.comment !== undefined, {
  message: 'Provide a status change or a comment',
});
export type UpdateStageDto = z.infer<typeof UpdateStageSchema>;

export const RequestRtoDocsSchema = z.object({
  docTypes: z.array(z.string().min(1)).min(1, 'At least one document is required'),
  remarks: z.string().trim().min(1, 'Remarks are required'),
  stageName: z.string().optional(),
});
export type RequestRtoDocsDto = z.infer<typeof RequestRtoDocsSchema>;

export const RespondToRequestSchema = z.object({
  text: z.string().optional().default(''),
  attachments: z.array(z.object({ url: z.string().min(1), fileName: z.string().min(1) })).optional().default([]),
}).refine((d) => d.text.trim().length > 0 || d.attachments.length > 0, {
  message: 'Add a note or attach at least one file',
});
export type RespondToRequestDto = z.infer<typeof RespondToRequestSchema>;
