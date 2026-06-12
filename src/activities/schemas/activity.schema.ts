import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ActivityType } from '../../common/enums';

@Schema({ timestamps: true, collection: 'activities' })
export class Activity extends Document {
  @Prop({ type: Types.ObjectId, ref: 'LoanCase', required: true, index: true }) caseId: Types.ObjectId;
  @Prop({ enum: Object.values(ActivityType), default: ActivityType.Remark }) type: string;
  @Prop({ required: true }) description: string;
  @Prop() note?: string;
  @Prop() oldStatus?: string;
  @Prop() newStatus?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) createdBy: Types.ObjectId;
  @Prop() createdByName?: string;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
