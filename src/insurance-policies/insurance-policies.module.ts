import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InsurancePolicy, InsurancePolicySchema } from './schemas/insurance-policy.schema';
import { InsurancePoliciesService } from './insurance-policies.service';
import { InsurancePoliciesController } from './insurance-policies.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: InsurancePolicy.name, schema: InsurancePolicySchema }])],
  controllers: [InsurancePoliciesController],
  providers: [InsurancePoliciesService],
  exports: [InsurancePoliciesService],
})
export class InsurancePoliciesModule {}
