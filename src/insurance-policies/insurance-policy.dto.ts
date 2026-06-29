import { z } from 'zod';
import { CoverageType } from './schemas/insurance-policy.schema';

const VEHICLE_TYPES = ['Car', 'Two Wheeler', 'Truck', 'Commercial Vehicle', 'Other'] as const;

export const CreateInsurancePolicySchema = z.object({
  name: z.string().min(1),
  insurer: z.string().min(1),
  coverageType: z.enum(Object.values(CoverageType) as [string, ...string[]]),
  vehicleTypes: z.array(z.enum(VEHICLE_TYPES)).optional(),
  premiumAmount: z.number().min(0),
  idvAmount: z.number().min(0).optional(),
  tenure: z.number().int().min(1).optional(),
  description: z.string().optional(),
});
export type CreateInsurancePolicyDto = z.infer<typeof CreateInsurancePolicySchema>;

export const UpdateInsurancePolicySchema = CreateInsurancePolicySchema.partial();
export type UpdateInsurancePolicyDto = z.infer<typeof UpdateInsurancePolicySchema>;
