import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PayrollStatus } from '../../common/enums';

@Schema({ _id: false })
class Incentive {
  @Prop({ required: true }) reason!: string;
  @Prop({ required: true, min: 0 }) amount!: number;
}
const IncentiveSchema = SchemaFactory.createForClass(Incentive);

@Schema({ _id: false })
class AdditionalDeduction {
  @Prop({ required: true }) reason!: string;
  @Prop({ required: true, min: 0 }) amount!: number;
}
const AdditionalDeductionSchema = SchemaFactory.createForClass(AdditionalDeduction);

export type PayrollDocument = HydratedDocument<Payroll>;

@Schema({ timestamps: true, collection: 'payrolls' })
export class Payroll {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  month!: string; // YYYY-MM

  @Prop({ default: 0 })
  basicSalary!: number;

  @Prop({ default: 0 })
  workingDaysInMonth!: number;

  @Prop({ default: 0 })
  presentDays!: number;

  @Prop({ default: 0 })
  halfDays!: number;

  @Prop({ default: 0 })
  absentDays!: number;

  @Prop({ default: 0 })
  leaveDays!: number;

  @Prop({ default: 0 })
  paidLeaveDays!: number;

  @Prop({ default: 0 })
  lwpDays!: number;

  // ── Allowances (copied from user at generation time) ──
  @Prop({ default: 0 }) hra!: number;
  @Prop({ default: 0 }) travelAllowance!: number;
  @Prop({ default: 0 }) da!: number;
  @Prop({ default: 0 }) medicalAllowance!: number;
  @Prop({ default: 0 }) otherAllowance!: number;

  @Prop({ type: [IncentiveSchema], default: [] })
  incentives!: Incentive[];

  @Prop({ type: [AdditionalDeductionSchema], default: [] })
  additionalDeductions!: AdditionalDeduction[];

  @Prop({ default: 0 })
  reimbursementTotal!: number;

  @Prop({ default: 0 })
  lopDeduction!: number; // Loss of Pay for absent days

  @Prop({ default: 0 })
  grossPay!: number;

  @Prop({ default: 0 })
  netPay!: number;

  @Prop({ enum: Object.values(PayrollStatus), default: PayrollStatus.Draft })
  status!: string;

  @Prop()
  paidAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  processedBy?: Types.ObjectId;

  @Prop()
  remarks?: string;
}

export const PayrollSchema = SchemaFactory.createForClass(Payroll);
PayrollSchema.index({ userId: 1, month: 1 }, { unique: true });
