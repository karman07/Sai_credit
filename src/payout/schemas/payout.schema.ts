import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InvoiceStatus, PayoutStatus } from '../../common/enums';

@Schema({ _id: false })
class LinkedCase {
  @Prop({ type: Types.ObjectId, ref: 'LoanCase' }) caseId: Types.ObjectId;
  @Prop() caseCode: string;
  @Prop() customerName?: string;
  @Prop() loanAmount?: number;
}
const LinkedCaseSchema = SchemaFactory.createForClass(LinkedCase);

@Schema({ timestamps: true, collection: 'payouts' })
export class PayoutRecord extends Document {
  @Prop({ required: true }) businessMonth: string;
  @Prop() invoiceDate?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Bank', index: true }) bankId?: Types.ObjectId;
  @Prop() bankName?: string;
  @Prop() company?: string;
  @Prop({ default: 0 }) volumeCases: number;
  @Prop({ type: [LinkedCaseSchema], default: [] }) linkedCases: LinkedCase[];
  @Prop({ enum: Object.values(InvoiceStatus), default: InvoiceStatus.Draft }) invoiceStatus: string;
  @Prop() invoiceNumber?: string;
  @Prop({ default: 0 }) invoiceAmount: number;
  @Prop({ default: 0 }) commission: number;
  @Prop({ default: 0 }) cgstAmount: number;
  @Prop({ default: 0 }) sgstAmount: number;
  @Prop({ default: 0 }) gstAmount: number;
  @Prop({ default: 0 }) totalAmount: number;
  @Prop({ enum: Object.values(PayoutStatus), default: PayoutStatus.Pending }) payoutStatus: string;
  @Prop() payoutDate?: Date;
  @Prop() remarks?: string;
  @Prop({ type: Object, default: {} }) customFields: Record<string, any>;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
}

export const PayoutRecordSchema = SchemaFactory.createForClass(PayoutRecord);
