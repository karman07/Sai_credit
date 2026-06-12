import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { DealersService } from './dealers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateDealerSchema, CreateDealerDto, UpdateDealerSchema, UpdateDealerDto } from './dealers.dto';

@Controller('dealers')
export class DealersController {
  constructor(private readonly svc: DealersService) {}

  @Get()
  @RequirePermissions('dealers.read')
  list(@Query('includeInactive') inc?: string) {
    return this.svc.list(inc === 'true');
  }

  @Get(':id')
  @RequirePermissions('dealers.read')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @RequirePermissions('dealers.create')
  create(
    @Body(new ZodValidationPipe(CreateDealerSchema)) dto: CreateDealerDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(dto, actor);
  }

  @Put(':id')
  @RequirePermissions('dealers.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDealerSchema)) dto: UpdateDealerDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Put(':id/toggle-status')
  @RequirePermissions('dealers.update')
  toggle(@Param('id') id: string) {
    return this.svc.toggleStatus(id);
  }

  @Delete(':id')
  @RequirePermissions('dealers.delete')
  remove(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
