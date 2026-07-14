import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailTemplate, MailTemplateSchema } from './schemas/mail-template.schema';
import { MailTemplatesService } from './mail-templates.service';
import { MailTemplatesController } from './mail-templates.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: MailTemplate.name, schema: MailTemplateSchema }])],
  controllers: [MailTemplatesController],
  providers: [MailTemplatesService],
  exports: [MailTemplatesService],
})
export class MailTemplatesModule {}
