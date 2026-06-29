import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateLeaveSchema, CreateLeaveDto, ReviewLeaveSchema, ReviewLeaveDto } from './leaves.dto';

@Controller('leaves')
export class LeavesController {
  constructor(private readonly svc: LeavesService) {}

  @Get('balance')
  @RequirePermissions('leaves.read')
  balance(
    @CurrentUser() actor: AuthUser,
    @Query('userId') userId?: string,
  ) {
    return this.svc.getBalance(actor, userId);
  }

  @Post()
  @RequirePermissions('leaves.create')
  create(
    @Body(new ZodValidationPipe(CreateLeaveSchema)) dto: CreateLeaveDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(actor, dto);
  }

  @Get()
  @RequirePermissions('leaves.read')
  list(
    @CurrentUser() actor: AuthUser,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('month') month?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(actor, {
      userId, status, month,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get(':id')
  @RequirePermissions('leaves.read')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.findById(id, actor);
  }

  @Put(':id/review')
  @RequirePermissions('leaves.manage')
  review(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReviewLeaveSchema)) dto: ReviewLeaveDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.review(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('leaves.create')
  cancel(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.cancel(id, actor);
  }
}
