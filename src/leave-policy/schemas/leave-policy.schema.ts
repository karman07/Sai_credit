import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export class LeaveTypeConfig {
  id: string;        // e.g. 'casual', 'sick', 'earned', 'festival', 'unpaid'
  name: string;      // display name
  daysPerYear: number;
  isPaid: boolean;
  color: string;     // hex or tailwind name for UI
}

export class PublicHoliday {
  date: string;  // YYYY-MM-DD
  name: string;
}

// Singleton document — only one per company
@Schema({ timestamps: true, collection: 'leave_policy' })
export class LeavePolicy extends Document {
  // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  @Prop({ type: [Number], default: [0] })
  weeklyOffDays: number[];  // default: Sunday off

  @Prop({ type: [Object], default: [
    { id: 'casual',   name: 'Casual Leave',   daysPerYear: 12, isPaid: true,  color: '#6366f1' },
    { id: 'sick',     name: 'Sick Leave',      daysPerYear: 6,  isPaid: true,  color: '#f59e0b' },
    { id: 'earned',   name: 'Earned Leave',    daysPerYear: 12, isPaid: true,  color: '#10b981' },
    { id: 'festival', name: 'Festival Leave',  daysPerYear: 5,  isPaid: true,  color: '#ec4899' },
    { id: 'unpaid',   name: 'Unpaid Leave',    daysPerYear: 0,  isPaid: false, color: '#6b7280' },
  ]})
  leaveTypes: LeaveTypeConfig[];

  @Prop({ type: [Object], default: [] })
  publicHolidays: PublicHoliday[];
}

export const LeavePolicySchema = SchemaFactory.createForClass(LeavePolicy);
