import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '../../common/enums';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ type: Types.ObjectId, ref: 'Master' })
  departmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Master' })
  designationId?: Types.ObjectId;

  @Prop({ unique: true, sparse: true })
  employeeCode?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ select: false })
  pwdResetTokenHash?: string;

  @Prop({ select: false })
  pwdResetExpiresAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);
