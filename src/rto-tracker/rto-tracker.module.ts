import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RTORecord, RTORecordSchema } from './schemas/rto-tracker.schema';
import { RTOTrackerService } from './rto-tracker.service';
import { RTOTrackerController } from './rto-tracker.controller';
import { LoanCase, LoanCaseSchema } from '../cases/schemas/case.schema';
import { Master, MasterSchema } from '../masters/schemas/master.schema';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RTORecord.name, schema: RTORecordSchema },
      { name: LoanCase.name, schema: LoanCaseSchema },
      { name: Master.name, schema: MasterSchema },
    ]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [RTOTrackerController],
  providers: [RTOTrackerService],
  exports: [RTOTrackerService],
})
export class RTOTrackerModule {}
