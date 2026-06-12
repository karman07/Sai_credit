import { z } from 'zod';
import { InsuranceOwnerType } from '../common/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export const CreateInsuranceMISSchema = z.object({
  caseId: objectId.optional(),
  caseCode: z.string().optional(),
  customerName: z.string().optional(),
  vehicleModel: z.string().optional(),
  insurer: z.string().min(1),
  ownerType: z.enum(Object.values(InsuranceOwnerType) as [string, ...string[]]).optional(),
  startDate: z.string(),
  endDate: z.string(),
  holdAmount: z.number().min(0).optional(),
  renewal: z.boolean().optional(),
});
export type CreateInsuranceMISDto = z.infer<typeof CreateInsuranceMISSchema>;

export const UpdateInsuranceMISSchema = CreateInsuranceMISSchema.partial();
export type UpdateInsuranceMISDto = z.infer<typeof UpdateInsuranceMISSchema>;
