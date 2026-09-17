import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

/**
 * Generic file upload — backs "File"-type custom fields defined in Form
 * Builder, which can appear on any form (case, insurance, RTO, payout, …)
 * and just need a URL to store as the field's value.
 */
@Controller('uploads')
export class UploadsController {
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `custom-field-${uniqueSuffix}${ext}`);
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
  }))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return { url: `/uploads/${file.filename}`, fileName: file.originalname };
  }
}
