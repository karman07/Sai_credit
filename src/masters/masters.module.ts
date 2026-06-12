import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MastersController } from './masters.controller';
import { MastersService } from './masters.service';
import { Master, MasterSchema } from './schemas/master.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Master.name, schema: MasterSchema }])],
  controllers: [MastersController],
  providers: [MastersService],
  exports: [MongooseModule],
})
export class MastersModule {}
