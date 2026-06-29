import { Controller, Get, Param } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly svc: ActivitiesService) {}

  @Get('case/:caseId')
  @RequirePermissions('cases.read')
  forCase(@Param('caseId') caseId: string) {
    return this.svc.forCase(caseId);
  }
}
