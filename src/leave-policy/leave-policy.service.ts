import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeavePolicy, LeaveTypeConfig, PublicHoliday } from './schemas/leave-policy.schema';

export interface UpdateLeavePolicyDto {
  weeklyOffDays?: number[];
  leaveTypes?: LeaveTypeConfig[];
  publicHolidays?: PublicHoliday[];
}

@Injectable()
export class LeavePolicyService {
  constructor(
    @InjectModel(LeavePolicy.name) private readonly model: Model<LeavePolicy>,
  ) {}

  /** Returns the singleton policy document, creating it with defaults if absent. */
  async getPolicy(): Promise<LeavePolicy> {
    let policy = await this.model.findOne().lean();
    if (!policy) {
      policy = await this.model.create({});
    }
    return policy as unknown as LeavePolicy;
  }

  /** Replace weekly off days, leave types, and/or public holidays. */
  async updatePolicy(dto: UpdateLeavePolicyDto): Promise<LeavePolicy> {
    // Ensure doc exists
    const existing = await this.model.findOne();
    if (!existing) {
      await this.model.create({});
    }

    const update: Record<string, any> = {};
    if (dto.weeklyOffDays !== undefined) update.weeklyOffDays = dto.weeklyOffDays;
    if (dto.leaveTypes   !== undefined) update.leaveTypes     = dto.leaveTypes;
    if (dto.publicHolidays !== undefined) update.publicHolidays = dto.publicHolidays;

    const updated = await this.model
      .findOneAndUpdate({}, { $set: update }, { new: true, upsert: true })
      .lean();
    return updated as unknown as LeavePolicy;
  }

  /** Add a single public holiday. Ignores duplicate dates. */
  async addHoliday(date: string, name: string): Promise<LeavePolicy> {
    const updated = await this.model
      .findOneAndUpdate(
        { 'publicHolidays.date': { $ne: date } },
        { $push: { publicHolidays: { date, name } } },
        { new: true, upsert: true },
      )
      .lean();
    // If upsert created a new doc, re-fetch
    return (updated ?? await this.model.findOne().lean()) as unknown as LeavePolicy;
  }

  /** Remove a public holiday by date string. */
  async removeHoliday(date: string): Promise<LeavePolicy> {
    const updated = await this.model
      .findOneAndUpdate(
        {},
        { $pull: { publicHolidays: { date } } },
        { new: true },
      )
      .lean();
    return updated as unknown as LeavePolicy;
  }
}
