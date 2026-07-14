import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Claim, ClaimSchema } from './schemas/claim.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ClaimsService } from './claims.service';
import { ClaimsController } from './claims.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Claim.name, schema: ClaimSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
    MailModule,
  ],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
