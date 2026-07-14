import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InsuranceMIS, InsuranceMISSchema } from './schemas/insurance-mis.schema';
import { InsuranceMISService } from './insurance-mis.service';
import { InsuranceMISController } from './insurance-mis.controller';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: InsuranceMIS.name, schema: InsuranceMISSchema }]),
    UsersModule,
    MailModule,
  ],
  controllers: [InsuranceMISController],
  providers: [InsuranceMISService],
  exports: [InsuranceMISService],
})
export class InsuranceMISModule {}
