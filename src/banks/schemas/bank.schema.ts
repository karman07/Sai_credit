import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'banks' })
export class Bank extends Document {
  @Prop({ required: true }) name: string;
  @Prop() branch?: string;
  @Prop() bmName?: string;
  @Prop() bmContact?: string;
  @Prop() executive?: string;
  @Prop() logoUrl?: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
}

export const BankSchema = SchemaFactory.createForClass(Bank);
