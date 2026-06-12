import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { InsuranceMISService } from './insurance-mis.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateInsuranceMISSchema, CreateInsuranceMISDto, UpdateInsuranceMISSchema, UpdateInsuranceMISDto } from './insurance-mis.dto';

@Controller('insurance-mis')
export class InsuranceMISController {
  constructor(private readonly svc: InsuranceMISService) {}

  @Get()
  @RequirePermissions('insurance.read')
  list(@Query('expiryDays') expiryDays?: string) {
    return this.svc.list(expiryDays);
  }

  @Get(':id')
  @RequirePermissions('insurance.read')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @RequirePermissions('insurance.create')
  create(
    @Body(new ZodValidationPipe(CreateInsuranceMISSchema)) dto: CreateInsuranceMISDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(dto, actor);
  }

  @Put(':id')
  @RequirePermissions('insurance.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInsuranceMISSchema)) dto: UpdateInsuranceMISDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('insurance.update')
  remove(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
