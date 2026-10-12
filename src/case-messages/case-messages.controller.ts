import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CaseMessagesService } from './case-messages.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SendCaseMessageSchema, SendCaseMessageDto } from './case-messages.dto';

@Controller('case-messages')
export class CaseMessagesController {
  constructor(private readonly svc: CaseMessagesService) {}

  @Get('case/:caseId')
  @RequirePermissions('cases.read')
  list(@Param('caseId') caseId: string, @CurrentUser() actor: AuthUser) {
    return this.svc.list(caseId, actor);
  }

  @Post('case/:caseId')
  @RequirePermissions('cases.update')
  send(
    @Param('caseId') caseId: string,
    @Body(new ZodValidationPipe(SendCaseMessageSchema)) dto: SendCaseMessageDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.send(caseId, dto, actor);
  }
}
