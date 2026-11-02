import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ChecklistItemStatus, RTOStatus } from '../../common/enums';

const statusEnum = Object.values(ChecklistItemStatus);

export enum RTOOwnershipType {
  Banker = 'Banker',
  Dealer = 'Dealer',
  SaiCreditSolutions = 'Sai Credit Solutions',
}

export const RTO_STAGE_STATUSES = ['Pending', 'In Progress', 'Done', 'NA'] as const;

@Schema({ _id: true, timestamps: false })
class StageComment {
  @Prop({ required: true }) text: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) authorId: Types.ObjectId;
  @Prop({ required: true }) authorName: string;
  @Prop({ required: true }) at: Date;
}
const StageCommentSchema = SchemaFactory.createForClass(StageComment);

/** One step of the RTO workflow. The step list comes from the `rto-stages` Data Catalog master. */
@Schema({ _id: false })
class RTOStage {
  @Prop({ required: true }) stageId: string;
  @Prop({ required: true }) name: string;
  @Prop({ default: 0 }) order: number;
  @Prop({ enum: RTO_STAGE_STATUSES, default: 'Pending' }) status: string;
  @Prop() doneAt?: Date;
  @Prop() updatedAt?: Date;
  @Prop() updatedByName?: string;
  @Prop({ type: [StageCommentSchema], default: [] }) comments: StageComment[];
}
const RTOStageSchema = SchemaFactory.createForClass(RTOStage);

@Schema({ _id: false })
class RequestResponse {
  @Prop({ default: '' }) text: string;
  @Prop({ type: [{ url: String, fileName: String }], default: [], _id: false }) attachments: { url: string; fileName: string }[];
  @Prop({ required: true }) byName: string;
  @Prop({ required: true }) at: Date;
}
const RequestResponseSchema = SchemaFactory.createForClass(RequestResponse);

/** A request from the RTO coordinator to the sales team for documents. */
@Schema({ _id: true, timestamps: false })
class RTODocRequest {
  @Prop({ type: [String], required: true }) docTypes: string[];
  @Prop({ required: true }) remarks: string;
  @Prop() stageName?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) requestedBy: Types.ObjectId;
  @Prop({ required: true }) requestedByName: string;
  @Prop({ required: true }) requestedAt: Date;
  @Prop({ type: RequestResponseSchema }) response?: RequestResponse;
  @Prop({ default: false }) isResolved: boolean;
  @Prop() resolvedAt?: Date;
  @Prop() resolvedByName?: string;
}
const RTODocRequestSchema = SchemaFactory.createForClass(RTODocRequest);

@Schema({ timestamps: true, collection: 'rto_records' })
export class RTORecord extends Document {
  @Prop({ type: Types.ObjectId, ref: 'LoanCase', index: true }) caseId?: Types.ObjectId;
  @Prop() caseCode?: string;
  @Prop() customerName?: string;

  // Overall lifecycle status — built-in values plus any admin-defined custom ones (see the
  // `rto-statuses` master), same pattern as LoanCase.status.
  @Prop({ required: true, default: RTOStatus.Pending, index: true }) status: string;

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

  // Workflow stages (from the `rto-stages` master) and the sales-team request loop
  @Prop({ type: [RTOStageSchema], default: [] }) stages: RTOStage[];
  @Prop({ type: [RTODocRequestSchema], default: [] }) docRequests: RTODocRequest[];

  // Denormalised from the case so access scoping and notifications don't need a case lookup
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) salesRepId?: Types.ObjectId;
  @Prop() salesRepName?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) salesCoordinatorId?: Types.ObjectId;
  @Prop() product?: string;

  // The RTO coordinator working this file (first to touch it) and completion
  @Prop({ type: Types.ObjectId, ref: 'User' }) rtoOwnerId?: Types.ObjectId;
  @Prop() rtoOwnerName?: string;
  @Prop() completedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
}

export const RTORecordSchema = SchemaFactory.createForClass(RTORecord);
