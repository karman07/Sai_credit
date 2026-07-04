import { z } from 'zod';
import { MasterType } from '../common/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** Maps the URL slug (e.g. `insurance-companies`) to a MasterType. */
export const SLUG_TO_TYPE: Record<string, MasterType> = {
  'insurance-companies': MasterType.InsuranceCompany,
  'vehicle-types':       MasterType.VehicleType,
  states:                MasterType.State,
  cities:                MasterType.City,
  'document-types':      MasterType.DocumentType,
  'enum-sets':           MasterType.EnumSet,
  'case-statuses':       MasterType.CaseStatus,
};

export const CreateMasterSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  shortName: z.string().optional(),
  parentId: objectId.optional(),
  colorClass: z.string().optional(),
  isTerminal: z.boolean().optional(),
  category: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateMasterDto = z.infer<typeof CreateMasterSchema>;

export const UpdateMasterSchema = CreateMasterSchema.partial();
export type UpdateMasterDto = z.infer<typeof UpdateMasterSchema>;
