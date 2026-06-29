import {
  Body, Controller, Get, Param, Post, Put, Query, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AttendanceService } from './attendance.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ClockInSchema, ClockInDto,
  ClockOutSchema, ClockOutDto,
  AdminMarkAttendanceSchema, AdminMarkAttendanceDto,
  UpdateAttendanceSchema, UpdateAttendanceDto,
} from './attendance.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  @Post('clock-in')
  @RequirePermissions('attendance.clock')
  clockIn(
    @Body(new ZodValidationPipe(ClockInSchema)) dto: ClockInDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.svc.clockIn(actor, dto, req.ip);
  }

  @Post('clock-out')
  @RequirePermissions('attendance.clock')
  clockOut(
    @Body(new ZodValidationPipe(ClockOutSchema)) dto: ClockOutDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.clockOut(actor, dto);
  }

  @Get('today')
  @RequirePermissions('attendance.read')
  today(@CurrentUser() actor: AuthUser) {
    return this.svc.today(actor);
  }

  @Get('summary')
  @RequirePermissions('attendance.read')
  summary(
    @CurrentUser() actor: AuthUser,
    @Query('userId') userId?: string,
    @Query('month') month?: string,
  ) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    return this.svc.summary(actor, userId ?? actor.id, m);
  }

  @Get('staff-list')
  @RequirePermissions('attendance.manage')
  staffList(@Query('month') month?: string) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    return this.svc.staffList(m);
  }

  @Get()
  @RequirePermissions('attendance.read')
  list(
    @CurrentUser() actor: AuthUser,
    @Query('userId') userId?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(actor, {
      userId,
      month,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 31,
    });
  }

  @Post('admin-mark')
  @RequirePermissions('attendance.manage')
  adminMark(
    @Body(new ZodValidationPipe(AdminMarkAttendanceSchema)) dto: AdminMarkAttendanceDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.adminMark(actor, dto);
  }

  @Post('auto-mark-absent')
  @RequirePermissions('attendance.manage')
  autoMarkAbsent(
    @Body('date') date: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.svc.autoMarkAbsent(d, actor.id);
  }

  @Post('backfill-month')
  @RequirePermissions('attendance.manage')
  backfillMonth(
    @Body('month') month: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    return this.svc.backfillMonth(m, actor.id);
  }

  @Put(':id')
  @RequirePermissions('attendance.manage')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAttendanceSchema)) dto: UpdateAttendanceDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.update(id, dto, actor);
  }
}
