import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export const CreateCoordinatorSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  region: z.string().optional(),
  linkedUserId: objectId.optional(),
});
export type CreateCoordinatorDto = z.infer<typeof CreateCoordinatorSchema>;

export const UpdateCoordinatorSchema = CreateCoordinatorSchema.partial();
export type UpdateCoordinatorDto = z.infer<typeof UpdateCoordinatorSchema>;
