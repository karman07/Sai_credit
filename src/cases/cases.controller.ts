import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CasesService } from './cases.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateCaseSchema, CreateCaseDto,
  UpdateCaseSchema, UpdateCaseDto,
  UpdateCaseStatusSchema, UpdateCaseStatusDto,
  AssignCaseSchema, AssignCaseDto,
  RequestDocsSchema, RequestDocsDto,
  UploadDocSchema, UploadDocDto,
  EditDocSchema, EditDocDto,
  UpdatePipelineStageSchema, UpdatePipelineStageDto,
} from './cases.dto';
import { isSalesRole, UserRole } from '../common/enums';

@Controller('cases')
export class CasesController {
  constructor(private readonly svc: CasesService) {}

  @Get('stats')
  @RequirePermissions('cases.read')
  stats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('bankId') bankId?: string,
    @Query('product') product?: string,
    @Query('firm') firm?: string,
  ) {
    return this.svc.stats({ from, to, bankId, product, firm });
  }

  @Get('stats/trend')
  @RequirePermissions('cases.read')
  trend(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: 'day' | 'month',
    @Query('bankId') bankId?: string,
    @Query('product') product?: string,
    @Query('firm') firm?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.trend({ from, to, groupBy, bankId, product, firm, status });
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
    @Query('product') product?: string,
    @Query('firm') firm?: string,
    @Query('assignedTo') assignedTo?: string,
    @CurrentUser() actor?: AuthUser,
  ) {
    const isSales = actor ? isSalesRole(actor.role) : false;
    const isCoordinator = actor?.role === UserRole.Coordinator;
    console.log('[DEBUG cases list()] actor=', JSON.stringify(actor), 'isCoordinator=', isCoordinator);
    return this.svc.list({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      search, status, bankId, dealerId, product, firm,
      assignedTo,
      userId: actor?.id,
      scopeToUser: isSales,
      coordinatorId: isCoordinator ? actor!.id : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('cases.read')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.findById(id, actor);
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

  @Put(':id/assign')
  @RequirePermissions('cases.update')
  assign(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignCaseSchema)) dto: AssignCaseDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.assign(id, dto, actor);
  }

  @Post(':id/request-docs')
  @RequirePermissions('cases.update')
  requestDocs(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RequestDocsSchema)) dto: RequestDocsDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.requestDocs(id, dto, actor);
  }

  @Post(':id/upload-doc')
  @RequirePermissions('cases.update')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
  }))
  uploadDoc(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UploadDocSchema)) dto: UploadDocDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
  ) {
    if (file) {
      dto.url = `/uploads/${file.filename}`;
    }
    return this.svc.uploadDoc(id, dto, actor);
  }

  @Delete(':id/docs/:docId')
  @RequirePermissions('cases.update')
  deleteDoc(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.deleteDoc(id, docId, actor);
  }

  @Put(':id/docs/:docId')
  @RequirePermissions('cases.update')
  editDoc(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body(new ZodValidationPipe(EditDocSchema)) dto: EditDocDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.editDoc(id, docId, dto, actor);
  }

  @Put(':id/resolve-doc-request/:reqId')
  @RequirePermissions('cases.update')
  resolveDocRequest(
    @Param('id') id: string,
    @Param('reqId') reqId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.resolveDocRequest(id, reqId, actor);
  }

  @Put(':id/submit-for-verification')
  @RequirePermissions('cases.update')
  submitForVerification(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.submitForVerification(id, actor);
  }

  @Put(':id/pipeline/:stage')
  @RequirePermissions('cases.update')
  updatePipelineStage(
    @Param('id') id: string,
    @Param('stage') stage: string,
    @Body(new ZodValidationPipe(UpdatePipelineStageSchema)) dto: UpdatePipelineStageDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.updatePipelineStage(id, decodeURIComponent(stage), dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('cases.delete')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.delete(id, actor);
  }
}
