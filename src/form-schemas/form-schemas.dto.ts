import { z } from 'zod';

const FieldDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'select', 'tel', 'date', 'boolean']),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional().default([]),
  order: z.number().int().min(0).optional().default(0),
  isCore: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

const SectionDefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  fields: z.array(FieldDefSchema),
});

export const UpdateFormSchemaDto = z.object({
  sections: z.array(SectionDefSchema),
});
export type UpdateFormSchemaDtoType = z.infer<typeof UpdateFormSchemaDto>;
