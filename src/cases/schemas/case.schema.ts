import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CaseStatus, ProductType, LoanType } from '../../common/enums';

@Schema({ _id: false })
class CustomerInfo {
  @Prop({ required: true }) firstName: string;
  @Prop({ required: true }) lastName: string;
  @Prop() fatherName?: string;
  @Prop({ required: true }) contact: string;
  @Prop() altContact?: string;
  @Prop() location?: string;
  @Prop() pinCode?: string;
  @Prop() residentialStatus?: string;
  @Prop({ default: false }) ebillOwner: boolean;
}
const CustomerInfoSchema = SchemaFactory.createForClass(CustomerInfo);

@Schema({ timestamps: true, collection: 'cases' })
export class LoanCase extends Document {
  @Prop({ required: true, unique: true, index: true }) caseCode: string;
  @Prop({ default: () => new Date() }) date: Date;

  @Prop({ type: CustomerInfoSchema, required: true }) customer: CustomerInfo;

  @Prop({ required: true, enum: Object.values(ProductType) }) product: string;
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

  @Prop() remarks?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) createdBy: Types.ObjectId;
  @Prop({ default: true }) isActive: boolean;
}

export const LoanCaseSchema = SchemaFactory.createForClass(LoanCase);
