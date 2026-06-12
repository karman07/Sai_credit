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
  @RequirePermissions('coordinators.read')
  list(@Query('includeInactive') inc?: string) {
    return this.svc.list(inc === 'true');
  }

  @Get(':id')
  @RequirePermissions('coordinators.read')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @RequirePermissions('coordinators.create')
  create(
    @Body(new ZodValidationPipe(CreateCoordinatorSchema)) dto: CreateCoordinatorDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(dto, actor);
  }

  @Put(':id')
  @RequirePermissions('coordinators.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCoordinatorSchema)) dto: UpdateCoordinatorDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Put(':id/toggle-status')
  @RequirePermissions('coordinators.update')
  toggle(@Param('id') id: string) {
    return this.svc.toggleStatus(id);
  }

  @Delete(':id')
  @RequirePermissions('coordinators.delete')
  remove(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
