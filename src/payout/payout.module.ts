import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PayoutRecord, PayoutRecordSchema } from './schemas/payout.schema';
import { Bank, BankSchema } from '../banks/schemas/bank.schema';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';

@Module({
  imports: [MongooseModule.forFeature([
    { name: PayoutRecord.name, schema: PayoutRecordSchema },
    { name: Bank.name, schema: BankSchema },
  ])],
  controllers: [PayoutController],
  providers: [PayoutService],
  exports: [PayoutService],
})
export class PayoutModule {}
