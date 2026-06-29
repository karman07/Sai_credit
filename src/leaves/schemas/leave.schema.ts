import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LeaveType, LeaveStatus } from '../../common/enums';

@Schema({ timestamps: true, collection: 'leaves' })
export class Leave extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ type: String, enum: Object.values(LeaveType), required: true }) type: LeaveType;
  @Prop({ required: true }) startDate: Date;
  @Prop({ required: true }) endDate: Date;
  @Prop({ required: true, min: 0.5 }) totalDays: number;
  @Prop({ required: true }) reason: string;
  @Prop({ type: String, enum: Object.values(LeaveStatus), default: LeaveStatus.Pending }) status: LeaveStatus;
  @Prop({ type: Types.ObjectId, ref: 'User' }) reviewedBy?: Types.ObjectId;
  @Prop() reviewNote?: string;
  @Prop() reviewedAt?: Date;
}

export const LeaveSchema = SchemaFactory.createForClass(Leave);
