import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InsuranceMIS, InsuranceMISSchema } from './schemas/insurance-mis.schema';
import { InsuranceMISService } from './insurance-mis.service';
import { InsuranceMISController } from './insurance-mis.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: InsuranceMIS.name, schema: InsuranceMISSchema }])],
  controllers: [InsuranceMISController],
  providers: [InsuranceMISService],
  exports: [InsuranceMISService],
})
export class InsuranceMISModule {}
