import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { LeavePolicyService, UpdateLeavePolicyDto } from './leave-policy.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@Controller('leave-policy')
export class LeavePolicyController {
  constructor(private readonly svc: LeavePolicyService) {}

  @Get()
  @RequirePermissions('leave_policy.read')
  getPolicy() {
    return this.svc.getPolicy();
  }

  @Put()
  @RequirePermissions('leave_policy.manage')
  updatePolicy(@Body() dto: UpdateLeavePolicyDto) {
    return this.svc.updatePolicy(dto);
  }

  @Post('holidays')
  @RequirePermissions('leave_policy.manage')
  addHoliday(@Body() body: { date: string; name: string }) {
    return this.svc.addHoliday(body.date, body.name);
  }

  @Delete('holidays/:date')
  @RequirePermissions('leave_policy.manage')
  removeHoliday(@Param('date') date: string) {
    return this.svc.removeHoliday(decodeURIComponent(date));
  }
}
