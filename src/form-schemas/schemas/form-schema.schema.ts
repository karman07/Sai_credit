import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FieldType = 'text' | 'number' | 'select' | 'tel' | 'date' | 'boolean';

@Schema({ _id: false })
export class FieldDef {
  @Prop({ required: true }) key: string;
  @Prop({ required: true }) label: string;
  @Prop({ required: true, enum: ['text', 'number', 'select', 'tel', 'date', 'boolean'] }) type: FieldType;
  @Prop({ default: false }) required: boolean;
  @Prop() placeholder?: string;
  @Prop() defaultValue?: string;
  @Prop({ type: [String], default: [] }) options: string[];
  @Prop({ default: 0 }) order: number;
  @Prop({ default: false }) isCore: boolean;
  @Prop({ default: true }) isActive: boolean;
}
const FieldDefSchema = SchemaFactory.createForClass(FieldDef);

@Schema({ _id: false })
export class SectionDef {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) title: string;
  @Prop({ type: [FieldDefSchema], default: [] }) fields: FieldDef[];
}
const SectionDefSchema = SchemaFactory.createForClass(SectionDef);

@Schema({ timestamps: true, collection: 'form_schemas' })
export class FormSchema extends Document {
  @Prop({ required: true, unique: true, index: true }) formId: string;
  @Prop({ type: [SectionDefSchema], default: [] }) sections: SectionDef[];
}

export const FormSchemaMongoSchema = SchemaFactory.createForClass(FormSchema);
