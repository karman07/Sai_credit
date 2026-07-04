import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoanCase, LoanCaseSchema } from './schemas/case.schema';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { ActivitiesModule } from '../activities/activities.module';
import { BanksModule } from '../banks/banks.module';
import { DealersModule } from '../dealers/dealers.module';
import { CounterModule } from '../common/counter/counter.module';
import { CustomersModule } from '../customers/customers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LoanCase.name, schema: LoanCaseSchema }]),
    ActivitiesModule,
    BanksModule,
    DealersModule,
    CounterModule,
    CustomersModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
