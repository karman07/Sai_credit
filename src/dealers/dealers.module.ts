import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Dealer, DealerSchema } from './schemas/dealer.schema';
import { DealersService } from './dealers.service';
import { DealersController } from './dealers.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Dealer.name, schema: DealerSchema }])],
  controllers: [DealersController],
  providers: [DealersService],
  exports: [DealersService],
})
export class DealersModule {}
