import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InsuranceLeadDocument = HydratedDocument<InsuranceLead>;

export enum InsuranceLeadStatus {
  New        = 'new',
  Contacted  = 'contacted',
  Interested = 'interested',
  Converted  = 'converted',
  Lost       = 'lost',
}

export enum InsuranceLeadSource {
  WalkIn    = 'walk_in',
  Referral  = 'referral',
  Campaign  = 'campaign',
  Online    = 'online',
  Other     = 'other',
}

@Schema({ timestamps: true, collection: 'insurance_leads' })
export class InsuranceLead {
  @Prop({ required: true, unique: true, index: true }) leadCode!: string;

  @Prop({ required: true }) firstName!: string;
  @Prop({ required: true }) lastName!: string;
  @Prop({ required: true }) contact!: string;
  @Prop() altContact?: string;

  @Prop() vehicleType?: string;
  @Prop() vehicleModel?: string;
  @Prop() regNumber?: string;
  @Prop() vehicleYear?: number;

  @Prop() existingInsurer?: string;
  @Prop() policyExpiryDate?: Date;

  @Prop() location?: string;
  @Prop() state?: string;
  @Prop() city?: string;

  @Prop({
    enum: Object.values(InsuranceLeadStatus),
    default: InsuranceLeadStatus.New,
    index: true,
  })
  status!: string;

  @Prop({ enum: Object.values(InsuranceLeadSource), default: InsuranceLeadSource.Other })
  source!: string;

  @Prop() remarks?: string;
  @Prop({ index: true }) followUpDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) assignedTo?: Types.ObjectId;
  @Prop() assignedToName?: string;

  @Prop({ type: Types.ObjectId, ref: 'InsuranceMIS' }) convertedMisId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) createdBy!: Types.ObjectId;
  @Prop({ required: true }) createdByName!: string;

  @Prop({ default: true }) isActive!: boolean;
}

export const InsuranceLeadSchema = SchemaFactory.createForClass(InsuranceLead);
