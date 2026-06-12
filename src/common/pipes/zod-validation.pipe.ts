import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

/**
 * Validates & coerces request payloads against a Zod schema.
 * Zod is the single source of truth: schemas type the DTOs and validate input.
 * Usage:  @Body(new ZodValidationPipe(CreateCustomerSchema)) dto: CreateCustomerDto
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) {
          fields[issue.path.join('.') || '_'] = issue.message;
        }
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields,
        });
      }
      throw err;
    }
  }
}
