import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'mail_templates' })
export class MailTemplate extends Document {
  /** Stable identifier the backend uses to look up this template — never edited by admins. */
  @Prop({ required: true, unique: true, index: true }) key: string;
  @Prop({ required: true }) name: string;
  @Prop() description?: string;
  /** Placeholder names (without braces) available for use in subject/html, e.g. "caseCode". */
  @Prop({ type: [String], default: [] }) variables: string[];
  @Prop({ required: true }) subject: string;
  @Prop({ required: true }) html: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User' }) updatedBy?: Types.ObjectId;
}

export const MailTemplateSchema = SchemaFactory.createForClass(MailTemplate);
