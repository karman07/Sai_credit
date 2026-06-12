import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'coordinators' })
export class Coordinator extends Document {
  @Prop({ required: true }) name: string;
  @Prop() phone?: string;
  @Prop() email?: string;
  @Prop() region?: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) linkedUserId?: Types.ObjectId;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy: Types.ObjectId;
}

export const CoordinatorSchema = SchemaFactory.createForClass(Coordinator);
