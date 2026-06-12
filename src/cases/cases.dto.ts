import { z } from 'zod';
import { CaseStatus, ProductType, LoanType } from '../common/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const CustomerSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fatherName: z.string().optional(),
  contact: z.string().optional(),
  altContact: z.string().optional(),
  location: z.string().optional(),
  pinCode: z.string().optional(),
  residentialStatus: z.string().optional(),
  ebillOwner: z.boolean().optional(),
});

export const CreateCaseSchema = z.object({
  customer: CustomerSchema,
  product: z.enum(Object.values(ProductType) as [string, ...string[]]).optional(),
  loanType: z.enum(Object.values(LoanType) as [string, ...string[]]).optional(),
  vehicleModel: z.string().optional(),
  regNumber: z.string().optional(),
  ownerSerial: z.string().optional(),
  existingInsurer: z.string().optional(),
  hypothecation: z.boolean().optional(),
  nocRequired: z.boolean().optional(),
  challanCount: z.number().int().min(0).optional(),
  loanAmount: z.number().min(0).optional(),
  bankId: objectId.optional(),
  bankBranch: z.string().optional(),
  bmName: z.string().optional(),
  bmContact: z.string().optional(),
  bankExecutive: z.string().optional(),
  dealerId: objectId.optional(),
  payoutPct: z.number().min(0).max(100).optional(),
  coordinatorId: objectId.optional(),
  assignedTo: objectId.optional(),
  remarks: z.string().optional(),
  status: z.enum(Object.values(CaseStatus) as [string, ...string[]]).optional(),
});
export type CreateCaseDto = z.infer<typeof CreateCaseSchema>;

export const UpdateCaseSchema = CreateCaseSchema.partial();
export type UpdateCaseDto = z.infer<typeof UpdateCaseSchema>;

export const UpdateCaseStatusSchema = z.object({
  status: z.enum(Object.values(CaseStatus) as [string, ...string[]]),
  disbursementDate: z.string().optional(),
  note: z.string().optional(),
});
export type UpdateCaseStatusDto = z.infer<typeof UpdateCaseStatusSchema>;

export const AssignCaseSchema = z.object({
  userId: objectId,
  userName: z.string().min(1),
});
export type AssignCaseDto = z.infer<typeof AssignCaseSchema>;

export const RequestDocsSchema = z.object({
  docTypes: z.array(z.string().min(1)).min(1, 'At least one document type required'),
  remarks: z.string().min(1, 'Remarks are required'),
});
export type RequestDocsDto = z.infer<typeof RequestDocsSchema>;

export const UploadDocSchema = z.object({
  docType: z.string().min(1),
  fileName: z.string().min(1),
  url: z.string().optional(),
  remarks: z.string().optional(),
});
export type UploadDocDto = z.infer<typeof UploadDocSchema>;

export const EditDocSchema = z.object({
  fileName: z.string().min(1).optional(),
  remarks: z.string().optional(),
});
export type EditDocDto = z.infer<typeof EditDocSchema>;
