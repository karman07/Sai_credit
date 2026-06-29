import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormSchemasController } from './form-schemas.controller';
import { FormSchemasService } from './form-schemas.service';
import { FormSchema, FormSchemaMongoSchema } from './schemas/form-schema.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: FormSchema.name, schema: FormSchemaMongoSchema }])],
  controllers: [FormSchemasController],
  providers: [FormSchemasService],
  exports: [FormSchemasService],
})
export class FormSchemasModule {}
