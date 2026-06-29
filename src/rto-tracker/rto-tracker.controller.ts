import { Body, Controller, Get, Param, Post, Put, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RTOTrackerService } from './rto-tracker.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateRTOSchema, CreateRTODto, UpdateRTOSchema, UpdateRTODto } from './rto-tracker.dto';

@Controller('rto-tracker')
export class RTOTrackerController {
  constructor(private readonly svc: RTOTrackerService) {}

  @Get()
  @RequirePermissions('rto.read')
  list(@Query('caseId') caseId?: string) {
    return this.svc.list(caseId);
  }

  @Get(':id')
  @RequirePermissions('rto.read')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
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
