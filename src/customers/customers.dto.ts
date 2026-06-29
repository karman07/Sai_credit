import { z } from 'zod';
import { CustomerType } from '../common/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const AddressSchema = z.object({
  addressType: z.string().default('communication'),
  line1: z.string().optional(),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  cityId: objectId.optional(),
  stateId: objectId.optional(),
  pincode: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const ContactSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const CreateCustomerSchema = z.object({
  customerType: z.nativeEnum(CustomerType).default(CustomerType.Individual),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.string().optional(),
  companyName: z.string().optional(),
  gstNumber: z.string().optional(),
  phone: z.string().min(7),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional(),
  whatsappNumber: z.string().optional(),
  panNumber: z.string().optional(),
  aadhaarLast4: z.string().length(4).optional(),
  addresses: z.array(AddressSchema).optional(),
  contacts: z.array(ContactSchema).optional(),
  assignedTo: objectId.optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = CreateCustomerSchema.partial();
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerSchema>;

export const ListCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().optional(),
  assignedTo: objectId.optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  tag: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>;

export const AssignSchema = z.object({ assignedTo: objectId });
export type AssignDto = z.infer<typeof AssignSchema>;
