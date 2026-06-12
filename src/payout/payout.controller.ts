import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreatePayoutSchema, CreatePayoutDto, UpdatePayoutSchema, UpdatePayoutDto } from './payout.dto';

@Controller('payout')
export class PayoutController {
  constructor(private readonly svc: PayoutService) {}

  @Get('months')
  @RequirePermissions('payout.read')
  months() {
    return this.svc.months();
  }

  @Get()
  @RequirePermissions('payout.read')
  list(@Query('month') month?: string, @Query('bankId') bankId?: string) {
    return this.svc.list(month, bankId);
  }

  @Get(':id')
  @RequirePermissions('payout.read')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @RequirePermissions('payout.create')
  create(
    @Body(new ZodValidationPipe(CreatePayoutSchema)) dto: CreatePayoutDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(dto, actor);
  }

  @Put(':id')
  @RequirePermissions('payout.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePayoutSchema)) dto: UpdatePayoutDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('payout.update')
  remove(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
