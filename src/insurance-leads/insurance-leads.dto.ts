import { z } from 'zod';
import { InsuranceLeadStatus, InsuranceLeadSource } from './schemas/insurance-lead.schema';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export const CreateInsuranceLeadSchema = z.object({
  firstName:         z.string().min(1),
  lastName:          z.string().min(1),
  contact:           z.string().min(6),
  altContact:        z.string().optional(),
  vehicleType:       z.string().optional(),
  vehicleModel:      z.string().optional(),
  regNumber:         z.string().optional(),
  vehicleYear:       z.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
  existingInsurer:   z.string().optional(),
  policyExpiryDate:  z.string().optional(),
  location:          z.string().optional(),
  state:             z.string().optional(),
  city:              z.string().optional(),
  status:            z.enum(Object.values(InsuranceLeadStatus) as [string, ...string[]]).optional(),
  source:            z.enum(Object.values(InsuranceLeadSource) as [string, ...string[]]).optional(),
  remarks:           z.string().optional(),
  followUpDate:      z.string().optional(),
  assignedTo:        objectId.optional(),
});
export type CreateInsuranceLeadDto = z.infer<typeof CreateInsuranceLeadSchema>;

export const UpdateInsuranceLeadSchema = CreateInsuranceLeadSchema.partial();
export type UpdateInsuranceLeadDto = z.infer<typeof UpdateInsuranceLeadSchema>;

export const ConvertLeadSchema = z.object({
  policyId:      objectId.optional(),
  policyName:    z.string().optional(),
  coverageType:  z.string().optional(),
  premiumAmount: z.number().min(0),
  insurer:       z.string().min(1),
  insuredName:   z.string().optional(),
  agentName:     z.string().optional(),
  startDate:     z.string(),
  endDate:       z.string(),
  caseId:        objectId.optional(),
  ownerType:     z.enum(['Bank', 'Sai Credit', 'Dealer']).optional(),
  holdAmount:    z.number().min(0).optional(),
  reminderDate:  z.string().optional(),
});
export type ConvertLeadDto = z.infer<typeof ConvertLeadSchema>;
