import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Leave } from './schemas/leave.schema';
import { Attendance } from '../attendance/schemas/attendance.schema';
import { User } from '../users/schemas/user.schema';
import { LeaveStatus, LeaveType, AttendanceStatus, isSalesRole, UserRole } from '../common/enums';
import { AuthUser } from '../common/types';
import { CreateLeaveDto, ReviewLeaveDto } from './leaves.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { LeavePolicyService } from '../leave-policy/leave-policy.service';

const PAID_LEAVE_TYPES: LeaveType[] = [LeaveType.Casual, LeaveType.Sick, LeaveType.Earned];

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

@Injectable()
export class LeavesService {
  constructor(
    @InjectModel(Leave.name) private readonly model: Model<Leave>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notifSvc: NotificationsService,
    private readonly policyService: LeavePolicyService,
  ) {}

  async create(actor: AuthUser, dto: CreateLeaveDto) {
    const start = new Date(dto.startDate + 'T00:00:00Z');
    const end   = new Date(dto.endDate   + 'T00:00:00Z');
    if (end < start) throw new BadRequestException('endDate must be on or after startDate');

    const msPerDay = 86400000;
    const totalDays = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;

    // For paid leave types, check that balance is sufficient
    if (PAID_LEAVE_TYPES.includes(dto.type as LeaveType)) {
      const user = await this.userModel.findById(actor.id).lean();
      const balance = user?.leaveBalance ?? 0;
      if (balance < totalDays) {
        throw new BadRequestException(
          `Insufficient leave balance. You have ${balance} day${balance !== 1 ? 's' : ''} remaining but requested ${totalDays}.`
        );
      }
    }

    return this.model.create({
      userId: new Types.ObjectId(actor.id),
      type: dto.type as LeaveType,
      startDate: start,
      endDate: end,
      totalDays,
      reason: dto.reason,
    });
  }

  async list(actor: AuthUser, query: {
    userId?: string; status?: string; month?: string; page?: number; limit?: number;
  }) {
    const isAdmin = !isSalesRole(actor.role as UserRole);
    const filter: Record<string, any> = {};

    if (isAdmin && query.userId) {
      filter.userId = new Types.ObjectId(query.userId);
    } else if (!isAdmin) {
      filter.userId = new Types.ObjectId(actor.id);
    }

    if (query.status) filter.status = query.status;

    if (query.month) {
      const [y, m] = query.month.split('-').map(Number);
      const from = new Date(Date.UTC(y, m - 1, 1));
      const to   = new Date(Date.UTC(y, m, 1));
      filter.startDate = { $lt: to };
      filter.endDate   = { $gte: from };
    }

    const page  = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip  = (page - 1) * limit;

    const [leaves, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('userId', 'firstName lastName employeeCode role')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit).lean(),
      this.model.countDocuments(filter),
    ]);

    return { leaves, total, page, limit };
  }

  async findById(id: string, actor: AuthUser) {
    const leave = await this.model.findById(id)
      .populate('userId', 'firstName lastName employeeCode role')
      .populate('reviewedBy', 'firstName lastName')
      .lean();
    if (!leave) throw new NotFoundException('Leave not found');
    const isAdmin = !isSalesRole(actor.role as UserRole);
    if (!isAdmin && String((leave.userId as any)._id ?? leave.userId) !== actor.id) {
      throw new ForbiddenException('Access denied');
    }
    return leave;
  }

  /** Get leave balance summary for a user */
  async getBalance(actor: AuthUser, targetUserId?: string) {
    const isAdmin = !isSalesRole(actor.role as UserRole);
    const uid = isAdmin && targetUserId ? targetUserId : actor.id;

    const user = await this.userModel.findById(uid).lean();
    if (!user) throw new NotFoundException('User not found');

    const year = new Date().getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd   = new Date(Date.UTC(year + 1, 0, 1));

    // Count approved paid leave days this year
    const paidLeavesThisYear = await this.model.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(uid),
          status: LeaveStatus.Approved,
          type: { $in: PAID_LEAVE_TYPES },
          startDate: { $lt: yearEnd },
          endDate:   { $gte: yearStart },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalDays' } } },
    ]);
    const usedPaidDays = paidLeavesThisYear[0]?.total ?? 0;

    // Pending leaves this year
    const [pendingLeaves, currentMonthAttendance] = await Promise.all([
      this.model.find({
        userId: new Types.ObjectId(uid),
        status: LeaveStatus.Pending,
      }).lean(),
      this.attendanceModel.find({
        userId: new Types.ObjectId(uid),
        date: { $regex: `^${new Date().toISOString().slice(0, 7)}` },
      }).lean(),
    ]);

    const policy = await this.policyService.getPolicy();

    return {
      annualLeaveQuota: user.annualLeaveQuota ?? 12,
      leaveBalance: user.leaveBalance ?? 0,
      usedPaidDays,
      pendingCount: pendingLeaves.length,
      weeklyOffDays: policy.weeklyOffDays,
      currentMonthAttendance: currentMonthAttendance.map((a) => ({
        date: a.date,
        status: a.status,
      })),
    };
  }

  async review(id: string, dto: ReviewLeaveDto, actor: AuthUser) {
    const leave = await this.model.findById(id);
    if (!leave) throw new NotFoundException('Leave not found');
    if (leave.status !== LeaveStatus.Pending) {
      throw new ForbiddenException('Only pending leaves can be reviewed');
    }

    const previousStatus = leave.status;
    leave.status     = dto.status as LeaveStatus;
    leave.reviewNote = dto.reviewNote;
    leave.reviewedBy = new Types.ObjectId(actor.id);
    leave.reviewedAt = new Date();
    await leave.save();

    const isPaidLeave = PAID_LEAVE_TYPES.includes(leave.type);

    // Deduct leave balance when a paid leave is approved
    if (dto.status === LeaveStatus.Approved && isPaidLeave) {
      await this.userModel.findByIdAndUpdate(
        leave.userId,
        { $inc: { leaveBalance: -leave.totalDays } },
      );
    }

    // On approval: mark attendance as on_leave for each day in range
    if (dto.status === LeaveStatus.Approved) {
      const days = datesBetween(
        leave.startDate.toISOString().slice(0, 10),
        leave.endDate.toISOString().slice(0, 10),
      );
      await Promise.all(
        days.map((date) =>
          this.attendanceModel.findOneAndUpdate(
            { userId: leave.userId, date },
            {
              $setOnInsert: { userId: leave.userId, date },
              $set: {
                status: AttendanceStatus.OnLeave,
                note: `Leave: ${leave.type}`,
                markedBy: new Types.ObjectId(actor.id),
              },
            },
            { upsert: true, new: true },
          ),
        ),
      );
    }

    // Notify the employee about the decision
    const approved = dto.status === LeaveStatus.Approved;
    const from = leave.startDate.toISOString().slice(0, 10);
    const to   = leave.endDate.toISOString().slice(0, 10);
    const dateRange = from === to ? from : `${from} to ${to}`;
    await this.notifSvc.notify({
      userId: String(leave.userId),
      type: approved ? 'leave_approved' : 'leave_rejected',
      title: approved ? 'Leave Approved' : 'Leave Rejected',
      message: approved
        ? `Your ${leave.type} leave (${dateRange}) has been approved.${dto.reviewNote ? ' Note: ' + dto.reviewNote : ''}`
        : `Your ${leave.type} leave (${dateRange}) was rejected.${dto.reviewNote ? ' Reason: ' + dto.reviewNote : ''}`,
    });

    return leave;
  }

  async cancel(id: string, actor: AuthUser) {
    const leave = await this.model.findById(id);
    if (!leave) throw new NotFoundException('Leave not found');
    const isAdmin = !isSalesRole(actor.role as UserRole);
    if (!isAdmin && String(leave.userId) !== actor.id) {
      throw new ForbiddenException('Access denied');
    }
    if (leave.status !== LeaveStatus.Pending) {
      throw new ForbiddenException('Only pending leaves can be cancelled');
    }
    leave.status = LeaveStatus.Cancelled;
    return leave.save();
  }
}
