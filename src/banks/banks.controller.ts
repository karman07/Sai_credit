import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { BanksService } from './banks.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateBankSchema, CreateBankDto, UpdateBankSchema, UpdateBankDto } from './banks.dto';

@Controller('banks')
export class BanksController {
  constructor(private readonly svc: BanksService) {}

  @Get()
  @RequirePermissions('banks.read')
  list(@Query('includeInactive') inc?: string) {
    return this.svc.list(inc === 'true');
  }

  @Get(':id')
  @RequirePermissions('banks.read')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @RequirePermissions('banks.create')
  create(
    @Body(new ZodValidationPipe(CreateBankSchema)) dto: CreateBankDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(dto, actor);
  }

  @Put(':id')
  @RequirePermissions('banks.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateBankSchema)) dto: UpdateBankDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.update(id, dto, actor);
  }

  @Put(':id/toggle-status')
  @RequirePermissions('banks.update')
  toggle(@Param('id') id: string) {
    return this.svc.toggleStatus(id);
  }

  @Delete(':id')
  @RequirePermissions('banks.delete')
  remove(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
