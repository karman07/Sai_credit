import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export const CreateDealerSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  coordinatorId: objectId.optional(),
});
export type CreateDealerDto = z.infer<typeof CreateDealerSchema>;

export const UpdateDealerSchema = CreateDealerSchema.partial();
export type UpdateDealerDto = z.infer<typeof UpdateDealerSchema>;
