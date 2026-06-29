import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeavePolicy, LeavePolicySchema } from './schemas/leave-policy.schema';
import { LeavePolicyService } from './leave-policy.service';
import { LeavePolicyController } from './leave-policy.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LeavePolicy.name, schema: LeavePolicySchema }]),
  ],
  controllers: [LeavePolicyController],
  providers: [LeavePolicyService],
  exports: [LeavePolicyService],
})
export class LeavePolicyModule {}
