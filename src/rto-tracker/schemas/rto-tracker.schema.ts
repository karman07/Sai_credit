import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ChecklistItemStatus } from '../../common/enums';

const statusEnum = Object.values(ChecklistItemStatus);

export enum RTOOwnershipType {
  Banker = 'Banker',
  Dealer = 'Dealer',
  SaiCreditSolutions = 'Sai Credit Solutions',
}

@Schema({ timestamps: true, collection: 'rto_records' })
export class RTORecord extends Document {
  @Prop({ type: Types.ObjectId, ref: 'LoanCase', index: true }) caseId?: Types.ObjectId;
  @Prop() caseCode?: string;
  @Prop() customerName?: string;

  // Ownership
  @Prop({ enum: Object.values(RTOOwnershipType) }) rtoOwnershipType?: string;

  // Checklist items
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) rtoOwnership: string;
  @Prop({ default: false }) rtoReceiving: boolean;
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) challanCheck: string;
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) bankNocCheck: string;
  @Prop({ default: 0 }) nocHoldAmt: number;
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) insuranceCheck: string;
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) hypothecation: string;
  @Prop({ enum: statusEnum, default: ChecklistItemStatus.Pending }) aadhaarMatch: string;
  @Prop() aadhaarMismatchNote?: string;

  // Pending docs list
  @Prop({ type: [String], default: [] }) pendingDocuments: string[];

  // RTO Slip upload
  @Prop() rtoSlipUrl?: string;
  @Prop() rtoSlipFileName?: string;

  // Progress stages
  @Prop({ enum: ['Pending', 'Done'], default: 'Pending' }) verification: string;
  @Prop({ enum: ['Pending', 'Done'], default: 'Pending' }) approval: string;
  @Prop() approvalDate?: Date;

  // Post-approval
  @Prop({ enum: ['Pending', 'Done'], default: 'Pending' }) insuranceEndorsement: string;
  @Prop({ default: 0 }) balancePayment: number;

  @Prop() remarks?: string;
  @Prop({ type: Object, default: {} }) customFields: Record<string, any>;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
}

export const RTORecordSchema = SchemaFactory.createForClass(RTORecord);
