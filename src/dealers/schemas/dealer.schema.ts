import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'dealers' })
export class Dealer extends Document {
  @Prop({ required: true }) name: string;
  @Prop() contact?: string;
  @Prop() location?: string;
  @Prop() address?: string;
  @Prop({ type: Types.ObjectId, ref: 'Coordinator' }) coordinatorId?: Types.ObjectId;
  @Prop() coordinatorName?: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
}

export const DealerSchema = SchemaFactory.createForClass(Dealer);
