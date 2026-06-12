import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CustomerType } from '../../common/enums';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ _id: false })
export class Address {
  @Prop({ default: 'communication' }) addressType!: string;
  @Prop() line1?: string;
  @Prop() line2?: string;
  @Prop() landmark?: string;
  @Prop({ type: Types.ObjectId, ref: 'Master' }) cityId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Master' }) stateId?: Types.ObjectId;
  @Prop() pincode?: string;
  @Prop({ default: false }) isPrimary!: boolean;
}
export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ _id: false })
export class Contact {
  @Prop({ required: true }) name!: string;
  @Prop() relationship?: string;
  @Prop() phone?: string;
  @Prop() email?: string;
}
export const ContactSchema = SchemaFactory.createForClass(Contact);

@Schema({ timestamps: true, collection: 'customers' })
export class Customer {
  @Prop({ required: true, unique: true })
  customerCode!: string; // CUS-2026-00001

  @Prop({ required: true, enum: CustomerType, default: CustomerType.Individual })
  customerType!: CustomerType;

  @Prop({ required: true, trim: true }) firstName!: string;
  @Prop({ required: true, trim: true }) lastName!: string;
  @Prop() dateOfBirth?: Date;
  @Prop() gender?: string;

  // corporate
  @Prop() companyName?: string;
  @Prop() gstNumber?: string;

  // contact
  @Prop({ required: true, index: true }) phone!: string;
  @Prop() alternatePhone?: string;
  @Prop({ lowercase: true, trim: true }) email?: string;
  @Prop() whatsappNumber?: string;

  // KYC
  @Prop() panNumber?: string;
  @Prop() aadhaarLast4?: string;

  @Prop({ type: [AddressSchema], default: [] }) addresses!: Address[];
  @Prop({ type: [ContactSchema], default: [] }) contacts!: Contact[];

  @Prop({ type: Types.ObjectId, ref: 'Master' }) leadSourceId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedTo?: Types.ObjectId;

  @Prop({ type: [String], default: [] }) tags!: string[];
  @Prop() notes?: string;

  @Prop({ default: true }) isActive!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy?: Types.ObjectId;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
// Text index powers full-text search across name / company / code.
CustomerSchema.index({
  firstName: 'text',
  lastName: 'text',
  companyName: 'text',
  customerCode: 'text',
  email: 'text',
});
CustomerSchema.index({ assignedTo: 1, createdAt: -1 });
