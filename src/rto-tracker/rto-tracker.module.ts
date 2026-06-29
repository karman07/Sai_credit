import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RTORecord, RTORecordSchema } from './schemas/rto-tracker.schema';
import { RTOTrackerService } from './rto-tracker.service';
import { RTOTrackerController } from './rto-tracker.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RTORecord.name, schema: RTORecordSchema }]),
    NotificationsModule,
  ],
  controllers: [RTOTrackerController],
  providers: [RTOTrackerService],
  exports: [RTOTrackerService],
})
export class RTOTrackerModule {}
