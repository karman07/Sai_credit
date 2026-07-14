import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { MailTemplatesService } from './mail-templates.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UpdateMailTemplateSchema, UpdateMailTemplateDto } from './mail-templates.dto';

@Controller('mail-templates')
export class MailTemplatesController {
  constructor(private readonly svc: MailTemplatesService) {}

  @Get()
  @RequirePermissions('mail_templates.manage')
  list() {
    return this.svc.list();
  }

  @Get(':key')
  @RequirePermissions('mail_templates.manage')
  findOne(@Param('key') key: string) {
    return this.svc.getByKey(key);
  }

  @Put(':key')
  @RequirePermissions('mail_templates.manage')
  update(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(UpdateMailTemplateSchema)) dto: UpdateMailTemplateDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.update(key, dto, actor);
  }
}
