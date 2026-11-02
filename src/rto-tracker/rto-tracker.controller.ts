import { Body, Controller, Get, Param, Post, Put, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RTOTrackerService } from './rto-tracker.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateRTOSchema, CreateRTODto, UpdateRTOSchema, UpdateRTODto,
  UpdateStageSchema, UpdateStageDto, RequestRtoDocsSchema, RequestRtoDocsDto,
  RespondToRequestSchema, RespondToRequestDto,
} from './rto-tracker.dto';

@Controller('rto-tracker')
export class RTOTrackerController {
  constructor(private readonly svc: RTOTrackerService) {}

  @Get()
  @RequirePermissions('rto.read')
  list(@CurrentUser() actor: AuthUser, @Query('caseId') caseId?: string) {
    return this.svc.list(actor, caseId);
  }

  @Get('by-case/:caseId')
  @RequirePermissions('rto.read')
  getByCase(@Param('caseId') caseId: string, @CurrentUser() actor: AuthUser) {
    return this.svc.getByCase(caseId, actor);
  }

  @Get(':id')
  @RequirePermissions('rto.read')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.findById(id, actor);
  }

  @Put(':id/stages/:stageId')
  @RequirePermissions('rto.update')
  updateStage(
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body(new ZodValidationPipe(UpdateStageSchema)) dto: UpdateStageDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.updateStage(id, stageId, dto, actor);
  }

  @Post(':id/request-docs')
  @RequirePermissions('rto.update')
  requestDocs(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RequestRtoDocsSchema)) dto: RequestRtoDocsDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.requestDocs(id, dto, actor);
  }

  @Put(':id/requests/:reqId/resolve')
  @RequirePermissions('rto.update')
  resolveRequest(@Param('id') id: string, @Param('reqId') reqId: string, @CurrentUser() actor: AuthUser) {
    return this.svc.resolveRequest(id, reqId, actor);
  }

  // Sales-side answer to a request; scoped to the rep's own files by the service.
  @Post(':id/requests/:reqId/respond')
  @RequirePermissions('rto.read')
  respond(
    @Param('id') id: string,
    @Param('reqId') reqId: string,
    @Body(new ZodValidationPipe(RespondToRequestSchema)) dto: RespondToRequestDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.respond(id, reqId, dto, actor);
  }

  @Post()
  @RequirePermissions('rto.update')
  create(
    @Body(new ZodValidationPipe(CreateRTOSchema)) dto: CreateRTODto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(dto, actor);
  }

  @Put(':id')
  @RequirePermissions('rto.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRTOSchema)) dto: UpdateRTODto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.update(id, dto, actor);
  }

  @Put('by-case/:caseId')
  @RequirePermissions('rto.update')
  upsertByCase(
    @Param('caseId') caseId: string,
    @Body(new ZodValidationPipe(UpdateRTOSchema)) dto: UpdateRTODto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.upsertByCaseId(caseId, dto, actor);
  }

  @Post(':id/upload-slip')
  @RequirePermissions('rto.update')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `rto-slip-${unique}${extname(file.originalname)}`);
      },
    }),
  }))
  uploadSlip(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.update(id, {
      rtoSlipUrl: `/uploads/${file.filename}`,
      rtoSlipFileName: file.originalname,
    }, actor);
  }
}
