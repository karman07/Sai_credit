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

  /** For sales-role users: the coordinator responsible for their cases. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  coordinatorId?: Types.ObjectId;

  @Prop({ default: 0 })
  basicSalary?: number;

  /** House Rent Allowance */
  @Prop({ default: 0 })
  hra?: number;

  /** Travel / Conveyance Allowance */
  @Prop({ default: 0 })
  travelAllowance?: number;

  /** Dearness Allowance */
  @Prop({ default: 0 })
  da?: number;

  /** Medical Allowance */
  @Prop({ default: 0 })
  medicalAllowance?: number;

  /** Any other miscellaneous allowance */
  @Prop({ default: 0 })
  otherAllowance?: number;

  @Prop()
  designation?: string;

  @Prop()
  department?: string;

  @Prop()
  joiningDate?: Date;

  /** Total paid leave days allotted per year (default 12) */
  @Prop({ default: 12 })
  annualLeaveQuota?: number;

  /** Remaining paid leave days for the current year */
  @Prop({ default: 12 })
  leaveBalance?: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
