import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance } from './schemas/attendance.schema';
import { User } from '../users/schemas/user.schema';
import { Leave } from '../leaves/schemas/leave.schema';
import { LeavePolicy } from '../leave-policy/schemas/leave-policy.schema';
import { AttendanceStatus, LeaveStatus, isSalesRole, UserRole } from '../common/enums';
import { AuthUser } from '../common/types';
import {
  ClockInDto, ClockOutDto,
  AdminMarkAttendanceDto, UpdateAttendanceDto,
} from './attendance.dto';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private readonly model: Model<Attendance>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Leave.name) private readonly leaveModel: Model<Leave>,
    @InjectModel(LeavePolicy.name) private readonly policyModel: Model<LeavePolicy>,
  ) {}

  // Called automatically on login for sales roles.
  // Always fires on login — records the actual clock-in time.
  // Admin can still override status to absent afterwards.
  async autoClockIn(userId: string, ip?: string): Promise<void> {
    const date = todayStr();
    const existing = await this.model.findOne({ userId: new Types.ObjectId(userId), date }).lean();

    if (!existing) {
      // First login today — create a fresh present record
      await this.model.create({
        userId: new Types.ObjectId(userId),
        date,
        clockIn: new Date(),
        status: AttendanceStatus.Present,
        ipAddress: ip,
      });
    } else if (!existing.clockIn) {
      // Don't override approved leave or holiday — user logging in on leave doesn't cancel it
      const protectedStatuses = [AttendanceStatus.OnLeave, AttendanceStatus.Holiday];
      if (protectedStatuses.includes(existing.status as AttendanceStatus)) return;

      // Record exists (e.g. admin pre-marked absent) but user has now actually logged in
      // — update to present and stamp the real clock-in time
      await this.model.updateOne(
        { _id: existing._id },
        { $set: { clockIn: new Date(), status: AttendanceStatus.Present, ipAddress: ip } },
      );
    }
    // If clockIn is already set, the day was already started — do nothing
  }

  // Called automatically on logout for sales roles.
  // Only fires if there's a clock-in with no clock-out yet.
  async autoClockOut(userId: string): Promise<void> {
    const date = todayStr();
    const record = await this.model.findOne({ userId: new Types.ObjectId(userId), date });
    if (!record || !record.clockIn || record.clockOut) return;

    const clockOut = new Date();
    const workHours = Math.round(
      ((clockOut.getTime() - record.clockIn.getTime()) / 3600000) * 100,
    ) / 100;

    record.clockOut = clockOut;
    record.workHours = workHours;
    if (workHours < 4.5 && record.status === AttendanceStatus.Present) {
      record.status = AttendanceStatus.HalfDay;
    }
    await record.save();
  }

  async clockIn(actor: AuthUser, dto: ClockInDto, ip?: string) {
    const date = dto.date ?? todayStr();
    const existing = await this.model.findOne({ userId: new Types.ObjectId(actor.id), date }).lean();
    if (existing?.clockIn) {
      throw new ConflictException('Already clocked in for this date');
    }
    if (existing) {
      return this.model.findByIdAndUpdate(
        existing._id,
        { clockIn: new Date(), note: dto.note, ipAddress: ip, status: AttendanceStatus.Present },
        { new: true },
      ).lean();
    }
    return this.model.create({
      userId: new Types.ObjectId(actor.id),
      date,
      clockIn: new Date(),
      status: AttendanceStatus.Present,
      note: dto.note,
      ipAddress: ip,
    });
  }

  async clockOut(actor: AuthUser, dto: ClockOutDto) {
    const date = dto.date ?? todayStr();
    const record = await this.model.findOne({ userId: new Types.ObjectId(actor.id), date });
    if (!record) throw new NotFoundException('No clock-in record found for today');
    const clockOut = new Date();
    const workHours = record.clockIn
      ? Math.round(((clockOut.getTime() - record.clockIn.getTime()) / 3600000) * 100) / 100
      : 0;
    record.clockOut = clockOut;
    record.workHours = workHours;
    if (dto.note) record.note = dto.note;
    // Mark half-day if worked < 4.5 hours
    if (workHours < 4.5 && record.status === AttendanceStatus.Present) {
      record.status = AttendanceStatus.HalfDay;
    }
    return record.save();
  }

  async today(actor: AuthUser) {
    const date = todayStr();
    return this.model.findOne({ userId: new Types.ObjectId(actor.id), date }).lean();
  }

  async list(actor: AuthUser, query: { userId?: string; month?: string; status?: string; page?: number; limit?: number }) {
    const isAdmin = !isSalesRole(actor.role as UserRole);
    const filter: Record<string, any> = {};

    if (isAdmin && query.userId) {
      filter.userId = new Types.ObjectId(query.userId);
    } else if (!isAdmin) {
      filter.userId = new Types.ObjectId(actor.id);
    }

    if (query.month) {
      filter.date = { $regex: `^${query.month}` };
    }
    if (query.status) {
      filter.status = query.status;
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 31);
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('userId', 'firstName lastName employeeCode role')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return { records, total, page, limit };
  }

  async summary(actor: AuthUser, userId: string, month: string) {
    const isAdmin = !isSalesRole(actor.role as UserRole);
    const targetId = isAdmin && userId ? userId : actor.id;

    const records = await this.model
      .find({ userId: new Types.ObjectId(targetId), date: { $regex: `^${month}` } })
      .lean();

    const counts = {
      present: 0, absent: 0, halfDay: 0, onLeave: 0, holiday: 0, total: records.length,
    };
    for (const r of records) {
      if (r.status === AttendanceStatus.Present) counts.present++;
      else if (r.status === AttendanceStatus.Absent) counts.absent++;
      else if (r.status === AttendanceStatus.HalfDay) counts.halfDay++;
      else if (r.status === AttendanceStatus.OnLeave) counts.onLeave++;
      else if (r.status === AttendanceStatus.Holiday) counts.holiday++;
    }
    const totalWorkHours = records.reduce((s, r) => s + (r.workHours ?? 0), 0);
    return { ...counts, totalWorkHours: Math.round(totalWorkHours * 100) / 100 };
  }

  async adminMark(actor: AuthUser, dto: AdminMarkAttendanceDto) {
    const clockIn = dto.clockIn ? new Date(dto.clockIn) : undefined;
    const clockOut = dto.clockOut ? new Date(dto.clockOut) : undefined;
    let workHours = 0;
    if (clockIn && clockOut) {
      workHours = Math.round(((clockOut.getTime() - clockIn.getTime()) / 3600000) * 100) / 100;
    }
    return this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(dto.userId), date: dto.date },
      {
        $set: {
          status: dto.status,
          clockIn,
          clockOut,
          workHours,
          note: dto.note,
          markedBy: new Types.ObjectId(actor.id),
        },
      },
      { upsert: true, new: true },
    ).lean();
  }

  async update(id: string, dto: UpdateAttendanceDto, actor: AuthUser) {
    const record = await this.model.findById(id);
    if (!record) throw new NotFoundException('Attendance record not found');
    const clockIn = dto.clockIn ? new Date(dto.clockIn) : record.clockIn;
    const clockOut = dto.clockOut ? new Date(dto.clockOut) : record.clockOut;
    let workHours = record.workHours;
    if (clockIn && clockOut) {
      workHours = Math.round(((clockOut.getTime() - clockIn.getTime()) / 3600000) * 100) / 100;
    }
    return this.model.findByIdAndUpdate(
      id,
      { $set: { ...dto, clockIn, clockOut, workHours, markedBy: new Types.ObjectId(actor.id) } },
      { new: true },
    ).lean();
  }

  async staffList(month: string) {
    const users = await this.userModel
      .find({ isActive: true })
      .select('firstName lastName employeeCode role basicSalary')
      .lean();

    const records = await this.model
      .find({ date: { $regex: `^${month}` } })
      .lean();

    const byUser: Record<string, typeof records> = {};
    for (const r of records) {
      const uid = String(r.userId);
      if (!byUser[uid]) byUser[uid] = [];
      byUser[uid].push(r);
    }

    return users.map((u) => {
      const recs = byUser[String(u._id)] ?? [];
      const present = recs.filter((r) => r.status === AttendanceStatus.Present).length;
      const halfDay = recs.filter((r) => r.status === AttendanceStatus.HalfDay).length;
      const absent = recs.filter((r) => r.status === AttendanceStatus.Absent).length;
      const onLeave = recs.filter((r) => r.status === AttendanceStatus.OnLeave).length;
      return {
        userId: u._id,
        name: `${u.firstName} ${u.lastName}`,
        employeeCode: u.employeeCode,
        role: u.role,
        basicSalary: u.basicSalary ?? 0,
        present,
        halfDay,
        absent,
        onLeave,
        totalMarked: recs.length,
      };
    });
  }

  /**
   * Mark all active users who have no attendance record for a given date as Absent.
   * Respects weekly off days and public holidays from leave policy.
   * Skips users with an approved leave covering that date (marks them on_leave instead).
   * Called by the admin panel or the nightly cron job.
   */
  async autoMarkAbsent(date: string, actorId: string): Promise<{ marked: number; skipped: number }> {
    // Load leave policy for weekly-off days and public holidays
    const policy = await this.policyModel.findOne().lean();
    const weeklyOffDays: number[] = policy?.weeklyOffDays?.length ? policy.weeklyOffDays : [0];
    const holidaySet = new Set<string>((policy?.publicHolidays ?? []).map((h) => h.date));

    const [y, m, d] = date.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();

    // Skip configured weekly off days (e.g. Sunday, or Saturday+Sunday)
    if (weeklyOffDays.includes(dow)) return { marked: 0, skipped: 0 };

    // Skip public holidays — mark them as holiday instead
    if (holidaySet.has(date)) {
      const users = await this.userModel.find({ isActive: true }).select('_id').lean();
      let holidayMarked = 0;
      for (const u of users) {
        const uid = new Types.ObjectId(u._id as any);
        const exists = await this.model.exists({ userId: uid, date });
        if (!exists) {
          await this.model.create({
            userId: uid,
            date,
            status: AttendanceStatus.Holiday,
            note: policy?.publicHolidays?.find((h) => h.date === date)?.name ?? 'Public Holiday',
            markedBy: new Types.ObjectId(actorId),
          });
          holidayMarked++;
        }
      }
      return { marked: 0, skipped: holidayMarked };
    }

    const users = await this.userModel.find({ isActive: true }).select('_id').lean();
    const dateObj = new Date(date + 'T00:00:00Z');

    let marked = 0;
    let skipped = 0;

    for (const u of users) {
      const uid = new Types.ObjectId(u._id as any);
      const existing = await this.model.findOne({ userId: uid, date }).lean();

      if (existing) {
        skipped++;
        continue;
      }

      // Check for an approved leave covering this date
      const approvedLeave = await this.leaveModel.findOne({
        userId: uid,
        status: LeaveStatus.Approved,
        startDate: { $lte: dateObj },
        endDate: { $gte: dateObj },
      }).lean();

      if (approvedLeave) {
        // Sync missing on_leave record (can happen if leave was approved after attendance was expected)
        await this.model.create({
          userId: uid,
          date,
          status: AttendanceStatus.OnLeave,
          note: `Leave: ${approvedLeave.type}`,
          markedBy: new Types.ObjectId(actorId),
        });
        skipped++;
      } else {
        await this.model.create({
          userId: uid,
          date,
          status: AttendanceStatus.Absent,
          note: 'Auto-marked absent',
          markedBy: new Types.ObjectId(actorId),
        });
        marked++;
      }
    }

    return { marked, skipped };
  }

  /**
   * Backfill attendance for all past days (day 1 to yesterday) of the given month.
   * Each day runs through the same logic as autoMarkAbsent: respects weekly off,
   * public holidays, and approved leaves.
   */
  async backfillMonth(month: string, actorId: string): Promise<{ marked: number; skipped: number }> {
    const [y, m] = month.split('-').map(Number);
    const today = new Date().toISOString().slice(0, 10);
    const daysInMonth = new Date(y, m, 0).getDate();

    let totalMarked = 0;
    let totalSkipped = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (date >= today) break; // only backfill past days, not today or future
      const result = await this.autoMarkAbsent(date, actorId);
      totalMarked += result.marked;
      totalSkipped += result.skipped;
    }

    return { marked: totalMarked, skipped: totalSkipped };
  }
}
