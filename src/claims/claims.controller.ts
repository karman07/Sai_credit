import {
  BadRequestException,
  Body, Controller, Delete, Get, Param, Post, Put, Query,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ClaimsService } from './claims.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateClaimSchema, CreateClaimDto, ReviewClaimSchema, ReviewClaimDto } from './claims.dto';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly svc: ClaimsService) {}

  @Post()
  @RequirePermissions('claims.create')
  create(
    @Body(new ZodValidationPipe(CreateClaimSchema)) dto: CreateClaimDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.create(actor, dto);
  }

  @Get()
  @RequirePermissions('claims.read')
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
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get(':id')
  @RequirePermissions('claims.read')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.findById(id, actor);
  }

  @Put(':id/review')
  @RequirePermissions('claims.manage')
  review(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReviewClaimSchema)) dto: ReviewClaimDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.svc.review(id, dto, actor);
  }

  @Post(':id/upload-receipt')
  @RequirePermissions('claims.create')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `receipt-${unique}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (/\.(jpg|jpeg|png|gif|webp|pdf)$/i.test(file.originalname)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only images (JPG, PNG, GIF, WEBP) and PDF files are allowed'), false);
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  }))
  uploadReceipt(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthUser,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.svc.uploadReceipt(id, `/uploads/${file.filename}`, actor);
  }

  @Delete(':id')
  @RequirePermissions('claims.create')
  cancel(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.cancel(id, actor);
  }
}
