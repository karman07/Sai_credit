import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payroll, PayrollSchema } from './schemas/payroll.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Leave, LeaveSchema } from '../leaves/schemas/leave.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { LoanCase, LoanCaseSchema } from '../cases/schemas/case.schema';
import { ClaimsModule } from '../claims/claims.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeavePolicyModule } from '../leave-policy/leave-policy.module';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payroll.name, schema: PayrollSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Leave.name, schema: LeaveSchema },
      { name: User.name, schema: UserSchema },
      { name: LoanCase.name, schema: LoanCaseSchema },
    ]),
    ClaimsModule,
    NotificationsModule,
    LeavePolicyModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
