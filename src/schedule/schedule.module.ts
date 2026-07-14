import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleService } from './schedule.service';
import { InsuranceMIS, InsuranceMISSchema } from '../insurance-mis/schemas/insurance-mis.schema';
import { LoanCase, LoanCaseSchema } from '../cases/schemas/case.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: InsuranceMIS.name, schema: InsuranceMISSchema },
      { name: LoanCase.name, schema: LoanCaseSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
    AttendanceModule,
    MailModule,
  ],
  providers: [ScheduleService],
})
export class AppScheduleModule {}
