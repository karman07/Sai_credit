import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InsuranceOwnerType } from '../../common/enums';

@Schema({ timestamps: true, collection: 'insurance_mis' })
export class InsuranceMIS extends Document {
  @Prop({ type: Types.ObjectId, ref: 'LoanCase', index: true }) caseId?: Types.ObjectId;
  @Prop() caseCode?: string;
  @Prop() customerName?: string;
  @Prop() vehicleModel?: string;
  @Prop({ required: true }) insurer: string;
  @Prop({ enum: Object.values(InsuranceOwnerType), default: InsuranceOwnerType.Individual }) ownerType: string;
  @Prop({ required: true }) startDate: Date;
  @Prop({ required: true }) endDate: Date;
  @Prop({ default: 0 }) holdAmount: number;
  @Prop({ default: false }) renewal: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
  @Prop({ default: true }) isActive: boolean;
}

export const InsuranceMISSchema = SchemaFactory.createForClass(InsuranceMIS);
