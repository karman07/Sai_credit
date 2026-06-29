import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InsuranceLead, InsuranceLeadSchema } from './schemas/insurance-lead.schema';
import { InsuranceMIS, InsuranceMISSchema } from '../insurance-mis/schemas/insurance-mis.schema';
import { InsuranceLeadsService } from './insurance-leads.service';
import { InsuranceLeadsController } from './insurance-leads.controller';
import { CounterModule } from '../common/counter/counter.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InsuranceLead.name, schema: InsuranceLeadSchema },
      { name: InsuranceMIS.name,  schema: InsuranceMISSchema  },
    ]),
    CounterModule,
    AuthModule,
  ],
  controllers: [InsuranceLeadsController],
  providers:   [InsuranceLeadsService],
  exports:     [InsuranceLeadsService],
})
export class InsuranceLeadsModule {}
