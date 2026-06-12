import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CaseStatus, ProductType, LoanType } from '../../common/enums';

@Schema({ _id: false })
class CustomerInfo {
  @Prop() firstName?: string;
  @Prop() lastName?: string;
  @Prop() fatherName?: string;
  @Prop() contact?: string;
  @Prop() altContact?: string;
  @Prop() location?: string;
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

  @Prop({ enum: Object.values(ProductType) }) product?: string;
  @Prop({ enum: Object.values(LoanType) }) loanType?: string;
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
    enum: Object.values(CaseStatus),
    default: CaseStatus.Sales,
    index: true,
  })
  status: string;

  @Prop() disbursementDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Coordinator', index: true }) coordinatorId?: Types.ObjectId;
  @Prop() coordinatorName?: string;

  // Assignment
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) assignedTo?: Types.ObjectId;
  @Prop() assignedToName?: string;

  // Documents
  @Prop({ type: [CaseDocumentSchema], default: [] }) documents: CaseDocument[];

  // Document deficiency requests
  @Prop({ type: [DocRequestSchema], default: [] }) docRequests: DocRequest[];

  @Prop() remarks?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) createdBy: Types.ObjectId;
  @Prop({ default: true }) isActive: boolean;
}

export const LoanCaseSchema = SchemaFactory.createForClass(LoanCase);
