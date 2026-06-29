import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { FormSchemasService } from './form-schemas.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UpdateFormSchemaDto, UpdateFormSchemaDtoType } from './form-schemas.dto';

@Controller('form-schemas')
export class FormSchemasController {
  constructor(private readonly service: FormSchemasService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':formId')
  get(@Param('formId') formId: string) {
    return this.service.getOrCreate(formId);
  }

  @Put(':formId')
  @RequirePermissions('master.manage')
  update(
    @Param('formId') formId: string,
    @Body(new ZodValidationPipe(UpdateFormSchemaDto)) dto: UpdateFormSchemaDtoType,
  ) {
    return this.service.update(formId, dto);
  }
}
