import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CaseStatus, LoanType, Firm } from '../../common/enums';

export const PIPELINE_STAGES = [
  'CIBIL & TVR',
  'Documentation',
  'Field Verification',
  'Valuation',
  'In Credit',
  'RTO Documents',
  'Approved',
  'Detail Confirmation',
  'Disbursed',
] as const;
export type PipelineStageName = typeof PIPELINE_STAGES[number];

/** Products where vehicle RTO registration transfer is relevant. */
export const VEHICLE_PRODUCTS = ['Car Loan', 'Commercial Vehicle Loan'];

/** RTO Documents only applies to vehicle-loan products. */
export function pipelineStagesFor(product?: string): readonly string[] {
  return product && VEHICLE_PRODUCTS.includes(product)
    ? PIPELINE_STAGES
    : PIPELINE_STAGES.filter((s) => s !== 'RTO Documents');
}

@Schema({ _id: false })
class PipelineItem {
  @Prop({ required: true }) stage: string;
  @Prop({ enum: ['Pending', 'Done', 'NA'], default: 'Pending' }) status: string;
  @Prop() doneAt?: Date;
  @Prop() doneByName?: string;
  @Prop() remarks?: string;
}
const PipelineItemSchema = SchemaFactory.createForClass(PipelineItem);

@Schema({ _id: false })
class CustomerInfo {
  @Prop() firstName?: string;
  @Prop() lastName?: string;
  @Prop() fatherName?: string;
  @Prop() contact?: string;
  @Prop() altContact?: string;
  @Prop() location?: string;
  @Prop() state?: string;
  @Prop() district?: string;
  @Prop() pinCode?: string;
  @Prop() residentialStatus?: string;
  @Prop({ default: false }) ebillOwner: boolean;
}
const CustomerInfoSchema = SchemaFactory.createForClass(CustomerInfo);

@Schema({ _id: true, timestamps: false })
class CaseDocument {
  @Prop({ required: true }) docType: string;
  @Prop({ required: true }) fileName: string;
  @Prop({ default: '' }) url: string;
  @Prop() remarks?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) uploadedBy: Types.ObjectId;
  @Prop({ required: true }) uploadedByName: string;
  @Prop({ required: true }) uploadedAt: Date;
}
const CaseDocumentSchema = SchemaFactory.createForClass(CaseDocument);

@Schema({ _id: true, timestamps: false })
class DocRequest {
  @Prop({ type: [String], required: true }) docTypes: string[];
  @Prop({ required: true }) remarks: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) requestedBy: Types.ObjectId;
  @Prop({ required: true }) requestedByName: string;
  @Prop({ required: true }) requestedAt: Date;
  @Prop() resolvedAt?: Date;
  @Prop({ default: false }) isResolved: boolean;
}
const DocRequestSchema = SchemaFactory.createForClass(DocRequest);

@Schema({ timestamps: true, collection: 'cases' })
export class LoanCase extends Document {
  @Prop({ required: true, unique: true, index: true }) caseCode: string;
  @Prop({ default: () => new Date() }) date: Date;

  @Prop({ type: CustomerInfoSchema, required: true }) customer: CustomerInfo;

  @Prop() product?: string;
  @Prop({ enum: Object.values(LoanType) }) loanType?: string;
  @Prop({ enum: Object.values(Firm) }) firm?: string;
  @Prop() vehicleModel?: string;
  @Prop() regNumber?: string;
  @Prop() ownerSerial?: string;
  @Prop() existingInsurer?: string;
  @Prop({ default: false }) hypothecation: boolean;
  @Prop({ default: false }) nocRequired: boolean;
  @Prop({ default: 0 }) challanCount: number;
  @Prop({ default: 0 }) loanAmount: number;

  @Prop({ type: Types.ObjectId, ref: 'Bank', index: true }) bankId?: Types.ObjectId;
  @Prop() bankName?: string;
  @Prop() bankBranch?: string;
  @Prop() bmName?: string;
  @Prop() bmContact?: string;
  @Prop() bankExecutive?: string;

  @Prop({ type: Types.ObjectId, ref: 'Dealer', index: true }) dealerId?: Types.ObjectId;
  @Prop() dealerName?: string;
  @Prop({ default: 0 }) payoutPct: number;

  @Prop({
    required: true,
    default: CaseStatus.Sales,
    index: true,
  })
  status: string;

  @Prop() disbursementDate?: Date;

  // Assignment
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) assignedTo?: Types.ObjectId;
  @Prop() assignedToName?: string;

  // Coordinator overseeing the assigned sales rep (denormalized for fast display)
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) coordinatorId?: Types.ObjectId;
  @Prop() coordinatorName?: string;

  // Pipeline checklist
  @Prop({
    type: [PipelineItemSchema],
    default: () => PIPELINE_STAGES.map((stage) => ({ stage, status: 'Pending' })),
  })
  pipeline: PipelineItem[];

  // Documents
  @Prop({ type: [CaseDocumentSchema], default: [] }) documents: CaseDocument[];

  // Document deficiency requests
  @Prop({ type: [DocRequestSchema], default: [] }) docRequests: DocRequest[];

  @Prop({ type: Object, default: {} }) customFields: Record<string, any>;

  @Prop() remarks?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) createdBy: Types.ObjectId;
  @Prop({ default: true }) isActive: boolean;
}

export const LoanCaseSchema = SchemaFactory.createForClass(LoanCase);
