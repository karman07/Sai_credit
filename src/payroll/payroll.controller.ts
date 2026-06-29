import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  GeneratePayrollSchema, GeneratePayrollDto,
  UpdatePayrollSchema, UpdatePayrollDto,
} from './payroll.dto';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly svc: PayrollService) {}

  @Get('overview')
  @RequirePermissions('payroll.read')
  overview(@Query('month') month?: string) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    return this.svc.overview(m);
  }

  @Post('generate-all')
  @RequirePermissions('payroll.manage')
  generateAll(
    @Body('month') month: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    return this.svc.generateAll(m, actor);
  }

  @Post('generate-for-user')
  @RequirePermissions('payroll.manage')
  async generateForUser(
    @Body('userId') userId: string,
    @Body('month') month: string,
    @CurrentUser() actor: AuthUser,
  ) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    const result = await this.svc.generateForUser(userId, m, actor.id);
    return { result };
  }

  @Post('generate')
  @RequirePermissions('payroll.manage')
  generate(
    @Body(new ZodValidationPipe(GeneratePayrollSchema)) dto: GeneratePayrollDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.generate(dto, actor);
  }

  @Get()
  @RequirePermissions('payroll.read')
  list(
    @CurrentUser() actor: AuthUser,
    @Query('userId') userId?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(actor, {
      userId, month, status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 12,
    });
  }

  @Get(':id')
  @RequirePermissions('payroll.read')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.findById(id, actor);
  }

  @Put(':id')
  @RequirePermissions('payroll.manage')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePayrollSchema)) dto: UpdatePayrollDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.update(id, dto, actor);
  }
}
