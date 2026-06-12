import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ChecklistItemStatus } from '../../common/enums';

const statusEnum = Object.values(ChecklistItemStatus);

@Schema({ timestamps: true, collection: 'rto_records' })
export class RTORecord extends Document {
  @Prop({ type: Types.ObjectId, ref: 'LoanCase', index: true }) caseId?: Types.ObjectId;
  @Prop() caseCode?: string;
  @Prop() customerName?: string;

  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) rtoOwnership: string;
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) hypothecation: string;
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) bankNoc: string;
  @Prop({ default: 0 }) nocHoldAmt: number;
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) challanClearance: string;
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) aadhaarMatch: string;
  @Prop() aadhaarMismatchNote?: string;
  @Prop() remarks?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
}

export const RTORecordSchema = SchemaFactory.createForClass(RTORecord);
