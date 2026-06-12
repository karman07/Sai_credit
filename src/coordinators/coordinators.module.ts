import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Coordinator, CoordinatorSchema } from './schemas/coordinator.schema';
import { CoordinatorsService } from './coordinators.service';
import { CoordinatorsController } from './coordinators.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Coordinator.name, schema: CoordinatorSchema }])],
  controllers: [CoordinatorsController],
  providers: [CoordinatorsService],
  exports: [CoordinatorsService],
})
export class CoordinatorsModule {}
