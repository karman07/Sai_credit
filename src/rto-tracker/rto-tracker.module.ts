import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RTORecord, RTORecordSchema } from './schemas/rto-tracker.schema';
import { RTOTrackerService } from './rto-tracker.service';
import { RTOTrackerController } from './rto-tracker.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: RTORecord.name, schema: RTORecordSchema }])],
  controllers: [RTOTrackerController],
  providers: [RTOTrackerService],
  exports: [RTOTrackerService],
})
export class RTOTrackerModule {}
