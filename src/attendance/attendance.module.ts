import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Leave, LeaveSchema } from '../leaves/schemas/leave.schema';
import { LeavePolicy, LeavePolicySchema } from '../leave-policy/schemas/leave-policy.schema';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: User.name, schema: UserSchema },
      { name: Leave.name, schema: LeaveSchema },
      { name: LeavePolicy.name, schema: LeavePolicySchema },
    ]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
