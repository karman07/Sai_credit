import { z } from 'zod';
import { UserRole } from '../common/enums';

const allowanceFields = {
  basicSalary:     z.number().min(0).optional(),
  hra:             z.number().min(0).optional(),
  travelAllowance: z.number().min(0).optional(),
  da:              z.number().min(0).optional(),
  medicalAllowance:z.number().min(0).optional(),
  otherAllowance:  z.number().min(0).optional(),
};

export const CreateUserSchema = z.object({
  email:        z.string().email(),
  password:     z.string().min(8),
  firstName:    z.string().min(1),
  lastName:     z.string().min(1),
  phone:        z.string().optional(),
  role:         z.nativeEnum(UserRole),
  employeeCode: z.string().optional(),
  designation:  z.string().optional(),
  department:   z.string().optional(),
  joiningDate:  z.string().optional(),
  annualLeaveQuota: z.number().min(0).optional(),
  ...allowanceFields,
});
export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export const ListUsersQuerySchema = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(25),
  sort:    z.string().default('createdAt'),
  order:   z.enum(['asc', 'desc']).default('desc'),
  search:  z.string().trim().optional(),
  role:    z.nativeEnum(UserRole).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;
