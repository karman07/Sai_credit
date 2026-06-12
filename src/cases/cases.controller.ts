import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CasesService } from './cases.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateCaseSchema, CreateCaseDto, UpdateCaseSchema, UpdateCaseDto, UpdateCaseStatusSchema, UpdateCaseStatusDto } from './cases.dto';
import { isSalesRole } from '../common/enums';

@Controller('cases')
export class CasesController {
  constructor(private readonly svc: CasesService) {}

  @Get('stats')
  @RequirePermissions('cases.read')
  stats() {
    return this.svc.stats();
  }

  @Get()
  @RequirePermissions('cases.read')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('bankId') bankId?: string,
    @Query('dealerId') dealerId?: string,
    @Query('coordinatorId') coordinatorId?: string,
    @Query('product') product?: string,
    @CurrentUser() actor?: AuthUser,
  ) {
    return this.svc.list({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      search, status, bankId, dealerId, coordinatorId, product,
      userId: actor?.id,
      scopeToUser: actor ? isSalesRole(actor.role) : false,
    });
  }

  @Get(':id')
  @RequirePermissions('cases.read')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @RequirePermissions('cases.create')
  create(
    @Body(new ZodValidationPipe(CreateCaseSchema)) dto: CreateCaseDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(dto, actor);
  }

  @Put(':id')
  @RequirePermissions('cases.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCaseSchema)) dto: UpdateCaseDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.update(id, dto, actor);
  }

  @Put(':id/status')
  @RequirePermissions('cases.update')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCaseStatusSchema)) dto: UpdateCaseStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.updateStatus(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('cases.delete')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.delete(id, actor);
  }
}
