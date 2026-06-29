import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum CoverageType {
  Comprehensive = 'Comprehensive',
  ThirdParty = 'Third Party',
  OwnDamage = 'Own Damage',
}

@Schema({ timestamps: true, collection: 'insurance_policies' })
export class InsurancePolicy extends Document {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) insurer: string;
  @Prop({ enum: Object.values(CoverageType), required: true }) coverageType: string;
  @Prop({ type: [String], default: [] }) vehicleTypes: string[];
  @Prop({ required: true, min: 0 }) premiumAmount: number;
  @Prop({ min: 0 }) idvAmount?: number;
  @Prop({ default: 12 }) tenure: number;
  @Prop() description?: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
}

export const InsurancePolicySchema = SchemaFactory.createForClass(InsurancePolicy);
