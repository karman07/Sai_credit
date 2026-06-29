import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CoordinatorsService } from './coordinators.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateCoordinatorSchema, CreateCoordinatorDto, UpdateCoordinatorSchema, UpdateCoordinatorDto } from './coordinators.dto';

@Controller('coordinators')
export class CoordinatorsController {
  constructor(private readonly svc: CoordinatorsService) {}

  @Get()
  @RequirePermissions('users.manage')
  list(@Query('includeInactive') inc?: string) {
    return this.svc.list(inc === 'true');
  }

  @Get(':id')
  @RequirePermissions('users.manage')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @RequirePermissions('users.manage')
  create(
    @Body(new ZodValidationPipe(CreateCoordinatorSchema)) dto: CreateCoordinatorDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(dto, actor);
  }

  @Put(':id')
  @RequirePermissions('users.manage')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCoordinatorSchema)) dto: UpdateCoordinatorDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Put(':id/toggle-status')
  @RequirePermissions('users.manage')
  toggle(@Param('id') id: string) {
    return this.svc.toggleStatus(id);
  }

  @Delete(':id')
  @RequirePermissions('users.manage')
  remove(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
