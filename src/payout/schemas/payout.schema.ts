import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InvoiceStatus, PayoutStatus } from '../../common/enums';

@Schema({ timestamps: true, collection: 'payouts' })
export class PayoutRecord extends Document {
  @Prop({ required: true }) businessMonth: string;
  @Prop({ type: Types.ObjectId, ref: 'Bank', index: true }) bankId?: Types.ObjectId;
  @Prop() bankName?: string;
  @Prop() company?: string;
  @Prop({ default: 0 }) volumeCases: number;
  @Prop({ enum: Object.values(InvoiceStatus), default: InvoiceStatus.Draft }) invoiceStatus: string;
  @Prop() invoiceNumber?: string;
  @Prop({ default: 0 }) invoiceAmount: number;
  @Prop({ default: 0 }) commission: number;
  @Prop({ default: 0 }) gstAmount: number;
  @Prop({ default: 0 }) totalAmount: number;
  @Prop({ enum: Object.values(PayoutStatus), default: PayoutStatus.Pending }) payoutStatus: string;
  @Prop() payoutDate?: Date;
  @Prop() remarks?: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
}

export const PayoutRecordSchema = SchemaFactory.createForClass(PayoutRecord);
