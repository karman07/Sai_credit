import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AttendanceStatus } from '../../common/enums';

export type AttendanceDocument = HydratedDocument<Attendance>;

@Schema({ timestamps: true, collection: 'attendances' })
export class Attendance {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  date!: string; // YYYY-MM-DD

  @Prop()
  clockIn?: Date;

  @Prop()
  clockOut?: Date;

  @Prop({ default: 0 })
  workHours!: number;

  @Prop({ enum: Object.values(AttendanceStatus), default: AttendanceStatus.Present })
  status!: string;

  @Prop()
  note?: string;

  @Prop()
  ipAddress?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  markedBy?: Types.ObjectId;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
