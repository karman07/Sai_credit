import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Portal } from '../../common/enums';

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'sessions' })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /** sha256 of the opaque refresh token (never store the raw token). */
  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ required: true, enum: Portal })
  portal!: Portal;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
// TTL index — Mongo auto-removes expired sessions.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
