import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotifType =
  | 'insurance_reminder' | 'pipeline_complete' | 'rto_complete' | 'stagnant_case' | 'general'
  | 'leave_approved' | 'leave_rejected'
  | 'claim_approved' | 'claim_rejected'
  | 'payroll_paid' | 'incentive_added'
  | 'new_case';

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true }) type: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) message: string;
  @Prop() caseId?: string;
  @Prop() caseCode?: string;
  @Prop({ default: false }) isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });
