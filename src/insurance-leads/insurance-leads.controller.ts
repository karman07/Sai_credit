import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { InsuranceLeadsService } from './insurance-leads.service';
import {
  CreateInsuranceLeadSchema, UpdateInsuranceLeadSchema, ConvertLeadSchema,
} from './insurance-leads.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@UseGuards(JwtAuthGuard)
@Controller('insurance-leads')
export class InsuranceLeadsController {
  constructor(private readonly svc: InsuranceLeadsService) {}

  @Get('stats')
  stats(@Request() req: any) {
    return this.svc.stats(req.user);
  }

  @Get()
  list(@Request() req: any, @Query() q: any) {
    return this.svc.list(req.user, {
      status:     q.status,
      source:     q.source,
      assignedTo: q.assignedTo,
      search:     q.search,
      page:       q.page   ? parseInt(q.page,  10) : undefined,
      limit:      q.limit  ? parseInt(q.limit, 10) : undefined,
      mine:       q.mine === 'true',
    });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  create(
    @Request() req: any,
    @Body(new ZodValidationPipe(CreateInsuranceLeadSchema)) dto: any,
  ) {
    return this.svc.create(dto, req.user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInsuranceLeadSchema)) dto: any,
  ) {
    return this.svc.update(id, dto);
  }

  @Post(':id/convert')
  convert(
    @Param('id') id: string,
    @Request() req: any,
    @Body(new ZodValidationPipe(ConvertLeadSchema)) dto: any,
  ) {
    return this.svc.convertToMIS(id, dto, req.user);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
