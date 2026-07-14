import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum InsuranceOwnerType {
  Bank = 'Bank',
  SaiCredit = 'Sai Credit',
  Dealer = 'Dealer',
}

@Schema({ _id: false })
class Endorsement {
  @Prop() date?: Date;
  @Prop() note?: string;
}
const EndorsementSchema = SchemaFactory.createForClass(Endorsement);

/** One entry per renewal — recorded automatically whenever an update extends endDate. */
@Schema({ _id: false })
class RenewalEvent {
  @Prop({ required: true }) renewedAt: Date;
  @Prop() oldEndDate?: Date;
  @Prop({ required: true }) newEndDate: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) renewedBy?: Types.ObjectId;
  @Prop() renewedByName?: string;
}
const RenewalEventSchema = SchemaFactory.createForClass(RenewalEvent);

@Schema({ timestamps: true, collection: 'insurance_mis' })
export class InsuranceMIS extends Document {
  @Prop({ type: Types.ObjectId, ref: 'LoanCase', index: true }) caseId?: Types.ObjectId;
  @Prop() caseCode?: string;
  @Prop() customerName?: string;
  @Prop() customerEmail?: string;
  @Prop() vehicleModel?: string;
  @Prop({ type: Types.ObjectId, ref: 'InsurancePolicy', index: true }) policyId?: Types.ObjectId;
  @Prop() policyName?: string;
  @Prop() coverageType?: string;
  @Prop() vehicleType?: string;
  @Prop({ default: 0 }) premiumAmount: number;
  @Prop({ required: true }) insurer: string;
  @Prop({ enum: Object.values(InsuranceOwnerType), default: InsuranceOwnerType.Bank }) ownerType: string;

  // New fields
  @Prop() insuredName?: string;
  @Prop() agentName?: string;
  @Prop({ type: EndorsementSchema }) endorsement?: Endorsement;
  @Prop({ index: true }) reminderDate?: Date;

  @Prop({ required: true }) startDate: Date;
  @Prop({ required: true }) endDate: Date;
  @Prop({ default: 0 }) holdAmount: number;
  @Prop({ default: false }) renewal: boolean;
  @Prop({ type: [RenewalEventSchema], default: [] }) renewalHistory: RenewalEvent[];
  @Prop() lastRenewedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) createdBy: Types.ObjectId;
  @Prop() createdByName?: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: Object, default: {} }) customFields: Record<string, any>;
}

export const InsuranceMISSchema = SchemaFactory.createForClass(InsuranceMIS);
InsuranceMISSchema.index({ endDate: 1, isActive: 1 });
InsuranceMISSchema.index({ reminderDate: 1, isActive: 1 });
