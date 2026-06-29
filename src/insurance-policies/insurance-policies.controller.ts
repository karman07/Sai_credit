import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { InsurancePoliciesService } from './insurance-policies.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateInsurancePolicySchema, CreateInsurancePolicyDto,
  UpdateInsurancePolicySchema, UpdateInsurancePolicyDto,
} from './insurance-policy.dto';

@Controller('insurance-policies')
export class InsurancePoliciesController {
  constructor(private readonly svc: InsurancePoliciesService) {}

  @Get()
  @RequirePermissions('policies.read')
  list(@Query('includeInactive') includeInactive?: string) {
    return this.svc.list(includeInactive === 'true');
  }

  @Get(':id')
  @RequirePermissions('policies.read')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @RequirePermissions('policies.create')
  create(
    @Body(new ZodValidationPipe(CreateInsurancePolicySchema)) dto: CreateInsurancePolicyDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(dto, actor);
  }

  @Put(':id')
  @RequirePermissions('policies.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInsurancePolicySchema)) dto: UpdateInsurancePolicyDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Put(':id/toggle-status')
  @RequirePermissions('policies.update')
  toggleStatus(@Param('id') id: string) {
    return this.svc.toggleStatus(id);
  }

  @Delete(':id')
  @RequirePermissions('policies.delete')
  remove(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
