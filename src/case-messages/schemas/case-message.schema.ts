import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class MessageAttachment {
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) fileName: string;
  @Prop() fileType?: string;
}
const MessageAttachmentSchema = SchemaFactory.createForClass(MessageAttachment);

@Schema({ timestamps: true, collection: 'case_messages' })
export class CaseMessage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'LoanCase', required: true, index: true }) caseId: Types.ObjectId;
  @Prop({ default: '' }) text: string;
  @Prop({ type: [MessageAttachmentSchema], default: [] }) attachments: MessageAttachment[];
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) authorId: Types.ObjectId;
  @Prop({ required: true }) authorName: string;
  @Prop({ required: true }) authorRole: string;
}

export const CaseMessageSchema = SchemaFactory.createForClass(CaseMessage);
CaseMessageSchema.index({ caseId: 1, createdAt: 1 });
