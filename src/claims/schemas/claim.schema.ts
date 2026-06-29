import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ClaimType, ClaimStatus } from '../../common/enums';

export type ClaimDocument = HydratedDocument<Claim>;

@Schema({ timestamps: true, collection: 'claims' })
export class Claim {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  month!: string; // YYYY-MM

  @Prop({ required: true, enum: Object.values(ClaimType) })
  type!: string;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true })
  description!: string;

  @Prop()
  receiptUrl?: string;

  @Prop({ enum: Object.values(ClaimStatus), default: ClaimStatus.Pending, index: true })
  status!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewNote?: string;

  @Prop()
  reviewedAt?: Date;
}

export const ClaimSchema = SchemaFactory.createForClass(Claim);
