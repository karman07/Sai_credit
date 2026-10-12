import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseMessage, CaseMessageSchema } from './schemas/case-message.schema';
import { CaseMessagesService } from './case-messages.service';
import { CaseMessagesController } from './case-messages.controller';
import { CasesModule } from '../cases/cases.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CaseMessage.name, schema: CaseMessageSchema }]),
    CasesModule,
    UsersModule,
    NotificationsModule,
    MailModule,
  ],
  controllers: [CaseMessagesController],
  providers: [CaseMessagesService],
})
export class CaseMessagesModule {}
