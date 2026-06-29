import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Leave, LeaveSchema } from './schemas/leave.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeavePolicyModule } from '../leave-policy/leave-policy.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Leave.name, schema: LeaveSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
    LeavePolicyModule,
  ],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
