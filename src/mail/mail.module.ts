import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailTemplatesModule } from '../mail-templates/mail-templates.module';

@Module({
  imports: [MailTemplatesModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
