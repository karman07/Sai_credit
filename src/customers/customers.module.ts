import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { LoanCase, LoanCaseSchema } from '../cases/schemas/case.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: LoanCase.name, schema: LoanCaseSchema },
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [MongooseModule, CustomersService],
})
export class CustomersModule {}
