import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { MastersService } from './masters.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateMasterSchema, CreateMasterDto,
  UpdateMasterSchema, UpdateMasterDto,
} from './masters.dto';

@Controller('master')
export class MastersController {
  constructor(private readonly masters: MastersService) {}

  // Any authenticated user may READ lookups (needed to render forms).
  @Get(':resource')
  list(
    @Param('resource') resource: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.masters.list(resource, includeInactive === 'true', parentId);
  }

  // Write access is resource-scoped (e.g. sales roles may only manage Document
  // Types), so it's enforced inside MastersService rather than via a single
  // blanket @RequirePermissions — see MastersService.assertCanManage.
  @Post(':resource')
  create(
    @Param('resource') resource: string,
    @Body(new ZodValidationPipe(CreateMasterSchema)) dto: CreateMasterDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.masters.create(resource, dto, actor);
  }

  @Put(':resource/:id')
  update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMasterSchema)) dto: UpdateMasterDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.masters.update(resource, id, dto, actor);
  }

  @Put(':resource/:id/toggle-status')
  toggle(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.masters.toggleStatus(resource, id, actor);
  }
}
