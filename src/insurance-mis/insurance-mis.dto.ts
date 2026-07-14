import { z } from 'zod';
import { InsuranceOwnerType } from './schemas/insurance-mis.schema';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export const CreateInsuranceMISSchema = z.object({
  caseId: objectId.optional(),
  caseCode: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  vehicleModel: z.string().optional(),
  policyId: objectId.optional(),
  policyName: z.string().optional(),
  coverageType: z.string().optional(),
  vehicleType: z.string().optional(),
  premiumAmount: z.number().min(0).optional(),
  insurer: z.string().min(1),
  ownerType: z.enum(Object.values(InsuranceOwnerType) as [string, ...string[]]).optional(),
  insuredName: z.string().optional(),
  agentName: z.string().optional(),
  endorsement: z.object({
    date: z.string().optional(),
    note: z.string().optional(),
  }).optional(),
  reminderDate: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  holdAmount: z.number().min(0).optional(),
  renewal: z.boolean().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});
export type CreateInsuranceMISDto = z.infer<typeof CreateInsuranceMISSchema>;

export const UpdateInsuranceMISSchema = CreateInsuranceMISSchema.partial();
export type UpdateInsuranceMISDto = z.infer<typeof UpdateInsuranceMISSchema>;
