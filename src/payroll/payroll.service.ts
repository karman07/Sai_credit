import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payroll } from './schemas/payroll.schema';
import { Attendance } from '../attendance/schemas/attendance.schema';
import { Leave } from '../leaves/schemas/leave.schema';
import { User } from '../users/schemas/user.schema';
import { LoanCase } from '../cases/schemas/case.schema';
import { ClaimsService } from '../claims/claims.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LeavePolicyService } from '../leave-policy/leave-policy.service';
import {
  AttendanceStatus, PayrollStatus, CaseStatus,
  LeaveType, LeaveStatus,
  isSelfServiceRole, UserRole,
} from '../common/enums';
import { AuthUser } from '../common/types';
import { GeneratePayrollDto, UpdatePayrollDto } from './payroll.dto';

const PAID_LEAVE_TYPES: string[] = [LeaveType.Casual, LeaveType.Sick, LeaveType.Earned];

/**
 * Count working days in a month, excluding configured weekly off days and public holidays.
 * @param month    YYYY-MM
 * @param weeklyOffDays  0=Sun … 6=Sat. Defaults to [0] (Sunday).
 * @param publicHolidays Array of { date: 'YYYY-MM-DD' } objects.
 */
function workingDaysInMonth(
  month: string,
  weeklyOffDays: number[] = [0],
  publicHolidays: { date: string }[] = [],
): number {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();

  // Build a set of public holiday dates in this month for O(1) lookup
  const holidaySet = new Set<string>();
  for (const h of publicHolidays) {
    if (h.date.startsWith(month)) holidaySet.add(h.date);
  }

  let working = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, mon - 1, d);
    const dayOfWeek = date.getDay();
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!weeklyOffDays.includes(dayOfWeek) && !holidaySet.has(dateStr)) {
      working++;
    }
  }
  return working;
}

/**
 * Count working days of a leave that overlap with the given YYYY-MM month.
 * Excludes configured weekly off days and public holidays.
 */
function leaveOverlapDays(
  leave: { startDate: Date; endDate: Date },
  month: string,
  weeklyOffDays: number[] = [0],
  publicHolidays: { date: string }[] = [],
): number {
  const [year, mon] = month.split('-').map(Number);
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 0);

  const start = new Date(Math.max(leave.startDate.getTime(), monthStart.getTime()));
  const end = new Date(Math.min(leave.endDate.getTime(), monthEnd.getTime()));

  if (start > end) return 0;

  const holidaySet = new Set<string>(publicHolidays.map((h) => h.date));

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    if (!weeklyOffDays.includes(dayOfWeek) && !holidaySet.has(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Earned pay based on effective days worked.
 * Paid leaves are included in effectiveDays — they don't cause deductions.
 * Absent days and LWP (unpaid leaves) are excluded and generate LOP.
 */
function computePay(
  basic: number,
  workingDays: number,
  presentDays: number,
  halfDays: number,
  paidLeaveDays: number,
) {
  const effectiveDays = presentDays + halfDays * 0.5 + paidLeaveDays;
  const dailyRate = workingDays > 0 ? basic / workingDays : 0;
  const earned = Math.round(dailyRate * effectiveDays * 100) / 100;
  const lop = Math.round((basic - earned) * 100) / 100;
  return { earned, lop: lop > 0 ? lop : 0 };
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(Payroll.name) private readonly model: Model<Payroll>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(Leave.name) private readonly leaveModel: Model<Leave>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(LoanCase.name) private readonly caseModel: Model<LoanCase>,
    private readonly claimsService: ClaimsService,
    private readonly notifSvc: NotificationsService,
    private readonly leavePolicySvc: LeavePolicyService,
  ) {}

  async generate(dto: GeneratePayrollDto, actor: AuthUser) {
    const existing = await this.model.findOne({
      userId: new Types.ObjectId(dto.userId),
      month: dto.month,
    });
    if (existing) throw new ConflictException('Payroll already generated for this user and month');

    const user = await this.userModel.findById(dto.userId).lean();
    if (!user) throw new NotFoundException('User not found');

    // ── Fetch leave policy ─────────────────────────────────────────────
    const policy = await this.leavePolicySvc.getPolicy();
    const weeklyOffDays  = policy.weeklyOffDays ?? [0];
    const publicHolidays = policy.publicHolidays ?? [];

    // ── Attendance counts ──────────────────────────────────────────────
    const attendances = await this.attendanceModel
      .find({ userId: new Types.ObjectId(dto.userId), date: { $regex: `^${dto.month}` } })
      .lean();

    const presentDays = attendances.filter((a) => a.status === AttendanceStatus.Present).length;
    const halfDays    = attendances.filter((a) => a.status === AttendanceStatus.HalfDay).length;
    const absentDays  = attendances.filter((a) => a.status === AttendanceStatus.Absent).length;
    const leaveDays   = attendances.filter((a) => a.status === AttendanceStatus.OnLeave).length;

    // ── Leave breakdown: paid vs LWP ───────────────────────────────────
    const [year, mon] = dto.month.split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd   = new Date(year, mon, 0);

    const approvedLeaves = await this.leaveModel
      .find({
        userId:    new Types.ObjectId(dto.userId),
        status:    LeaveStatus.Approved,
        startDate: { $lte: monthEnd },
        endDate:   { $gte: monthStart },
      })
      .lean();

    let paidLeaveDays = 0;
    let lwpFromLeaves = 0;
    for (const leave of approvedLeaves) {
      const days = leaveOverlapDays(leave, dto.month, weeklyOffDays, publicHolidays);
      if (PAID_LEAVE_TYPES.includes(leave.type)) {
        paidLeaveDays += days;
      } else {
        lwpFromLeaves += days;
      }
    }

    // LWP = absent attendance days + approved unpaid leave days
    const lwpDays = absentDays + lwpFromLeaves;

    // ── Pay computation ────────────────────────────────────────────────
    const basicSalary      = user.basicSalary ?? 0;
    const hra              = user.hra ?? 0;
    const travelAllowance  = user.travelAllowance ?? 0;
    const da               = user.da ?? 0;
    const medicalAllowance = user.medicalAllowance ?? 0;
    const otherAllowance   = user.otherAllowance ?? 0;
    const totalAllowances  = hra + travelAllowance + da + medicalAllowance + otherAllowance;

    const wDays = dto.workingDaysInMonth ?? workingDaysInMonth(dto.month, weeklyOffDays, publicHolidays);
    const { earned, lop } = computePay(basicSalary + totalAllowances, wDays, presentDays, halfDays, paidLeaveDays);

    const reimbursementTotal = await this.claimsService.approvedTotalForMonth(dto.userId, dto.month);
    // `earned` already reflects absences (= basic × effectiveDays/workingDays).
    // LOP is stored for reporting only — do NOT subtract it again from earned.
    const grossPay = earned + reimbursementTotal;
    const netPay   = Math.max(0, grossPay);

    return this.model.create({
      userId: new Types.ObjectId(dto.userId),
      month:  dto.month,
      basicSalary,
      hra, travelAllowance, da, medicalAllowance, otherAllowance,
      workingDaysInMonth: wDays,
      presentDays,
      halfDays,
      absentDays,
      leaveDays,
      paidLeaveDays,
      lwpDays,
      incentives: [],
      reimbursementTotal,
      lopDeduction: lop,
      grossPay,
      netPay,
      status:      PayrollStatus.Draft,
      processedBy: new Types.ObjectId(actor.id),
      remarks:     dto.remarks,
    });
  }

  async list(
    actor: AuthUser,
    query: { userId?: string; month?: string; status?: string; page?: number; limit?: number },
  ) {
    const isAdmin = !isSelfServiceRole(actor.role as UserRole);
    const filter: Record<string, any> = {};

    if (isAdmin && query.userId) {
      filter.userId = new Types.ObjectId(query.userId);
    } else if (!isAdmin) {
      filter.userId = new Types.ObjectId(actor.id);
    }

    if (query.month)  filter.month  = query.month;
    if (query.status) filter.status = query.status;

    const page  = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, query.limit ?? 12);
    const skip  = (page - 1) * limit;

    const [payrolls, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('userId', 'firstName lastName employeeCode role designation')
        .populate('processedBy', 'firstName lastName')
        .sort({ month: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return { payrolls, total, page, limit };
  }

  async findById(id: string, actor: AuthUser) {
    const payroll = await this.model
      .findById(id)
      .populate('userId', 'firstName lastName employeeCode role designation department basicSalary')
      .populate('processedBy', 'firstName lastName')
      .lean();
    if (!payroll) throw new NotFoundException('Payroll record not found');
    const isAdmin = !isSelfServiceRole(actor.role as UserRole);
    if (!isAdmin && String(payroll.userId) !== actor.id) {
      throw new NotFoundException('Payroll record not found');
    }
    return payroll;
  }

  async update(id: string, dto: UpdatePayrollDto, actor: AuthUser) {
    const payroll = await this.model.findById(id);
    if (!payroll) throw new NotFoundException('Payroll record not found');

    const prevStatus     = payroll.status;
    const prevIncentives = JSON.stringify(payroll.incentives ?? []);

    const basicSalary     = dto.basicSalary     ?? payroll.basicSalary;
    const wDays           = dto.workingDaysInMonth ?? payroll.workingDaysInMonth;
    const presentDays     = dto.presentDays     ?? payroll.presentDays;
    const halfDays        = dto.halfDays        ?? payroll.halfDays;
    const paidLeaveDays   = dto.paidLeaveDays   ?? (payroll as any).paidLeaveDays ?? 0;
    const newIncentives        = dto.incentives ?? payroll.incentives;
    const incentivesTotal      = newIncentives.reduce((s, i) => s + i.amount, 0);
    const newAdditionalDeductions = dto.additionalDeductions ?? (payroll as any).additionalDeductions ?? [];
    const additionalDeductionsTotal = newAdditionalDeductions.reduce((s: number, d: any) => s + d.amount, 0);
    const reimbursementTotal   = dto.reimbursementTotal ?? payroll.reimbursementTotal;

    const { earned, lop } = computePay(basicSalary, wDays, presentDays, halfDays, paidLeaveDays);
    const finalLop = dto.lopDeduction !== undefined ? dto.lopDeduction : lop;
    // earned already equals basic minus the LOP. Incentives & reimbursements sit on top
    // of attendance pay and must never be absorbed by LOP.
    const grossPay = earned + incentivesTotal + reimbursementTotal;
    const netPay   = Math.max(0, grossPay - additionalDeductionsTotal);

    const updates: Record<string, any> = {
      ...dto,
      lopDeduction: finalLop,
      grossPay,
      netPay,
      processedBy: new Types.ObjectId(actor.id),
    };
    if (dto.paidAt) updates.paidAt = new Date(dto.paidAt);

    const updated = await this.model
      .findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate('userId', 'firstName lastName employeeCode role designation')
      .lean();

    if (!updated) return updated;
    const targetUserId = String((updated.userId as any)?._id ?? updated.userId);

    // Notify on status → paid
    if (dto.status === PayrollStatus.Paid && prevStatus !== PayrollStatus.Paid) {
      await this.notifSvc.notify({
        userId: targetUserId,
        type: 'payroll_paid',
        title: 'Salary Paid',
        message: `Your salary of ${fmtINR(netPay)} for ${payroll.month} has been paid.`,
      });
    }

    // Notify if incentives were added/changed
    if (dto.incentives && JSON.stringify(newIncentives) !== prevIncentives) {
      const added = newIncentives.filter(
        (ni) => !payroll.incentives.some((oi) => oi.reason === ni.reason && oi.amount === ni.amount),
      );
      for (const inc of added) {
        await this.notifSvc.notify({
          userId: targetUserId,
          type: 'incentive_added',
          title: 'Incentive Added',
          message: `An incentive of ${fmtINR(inc.amount)} (${inc.reason}) has been added to your ${payroll.month} salary.`,
        });
      }
    }

    return updated;
  }

  /** Build the payroll data object for a user+month from live DB state. */
  private async buildPayrollData(userId: string, month: string, actorId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) return null;

    // ── Fetch leave policy ─────────────────────────────────────────────
    const policy = await this.leavePolicySvc.getPolicy();
    const weeklyOffDays  = policy.weeklyOffDays ?? [0];
    const publicHolidays = policy.publicHolidays ?? [];

    const attendances = await this.attendanceModel
      .find({ userId: new Types.ObjectId(userId), date: { $regex: `^${month}` } })
      .lean();

    const presentDays = attendances.filter((a) => a.status === AttendanceStatus.Present).length;
    const halfDays    = attendances.filter((a) => a.status === AttendanceStatus.HalfDay).length;
    const absentDays  = attendances.filter((a) => a.status === AttendanceStatus.Absent).length;
    const leaveDays   = attendances.filter((a) => a.status === AttendanceStatus.OnLeave).length;

    const [year, mon] = month.split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd   = new Date(year, mon, 0);

    const approvedLeaves = await this.leaveModel.find({
      userId: new Types.ObjectId(userId),
      status: LeaveStatus.Approved,
      startDate: { $lte: monthEnd },
      endDate:   { $gte: monthStart },
    }).lean();

    let paidLeaveDays = 0;
    let lwpFromLeaves = 0;
    for (const leave of approvedLeaves) {
      const days = leaveOverlapDays(leave, month, weeklyOffDays, publicHolidays);
      if (PAID_LEAVE_TYPES.includes(leave.type)) paidLeaveDays += days;
      else lwpFromLeaves += days;
    }
    const lwpDays = absentDays + lwpFromLeaves;

    const basicSalary      = user.basicSalary ?? 0;
    const hra              = user.hra ?? 0;
    const travelAllowance  = user.travelAllowance ?? 0;
    const da               = user.da ?? 0;
    const medicalAllowance = user.medicalAllowance ?? 0;
    const otherAllowance   = user.otherAllowance ?? 0;
    const totalAllowances  = hra + travelAllowance + da + medicalAllowance + otherAllowance;

    const wDays = workingDaysInMonth(month, weeklyOffDays, publicHolidays);
    const { earned, lop } = computePay(basicSalary + totalAllowances, wDays, presentDays, halfDays, paidLeaveDays);
    const reimbursementTotal = await this.claimsService.approvedTotalForMonth(userId, month);
    const grossPay = earned + reimbursementTotal;
    const netPay   = Math.max(0, grossPay); // earned already = basic - lop; don't double-subtract

    return {
      userId: new Types.ObjectId(userId),
      month,
      basicSalary,
      hra, travelAllowance, da, medicalAllowance, otherAllowance,
      workingDaysInMonth: wDays,
      presentDays, halfDays, absentDays, leaveDays,
      paidLeaveDays, lwpDays,
      reimbursementTotal,
      lopDeduction: lop,
      grossPay, netPay,
      processedBy: new Types.ObjectId(actorId),
    };
  }

  /**
   * Generate or refresh a draft payroll for one user.
   * Returns 'created' | 'refreshed' | 'skipped'.
   * Skips only if payroll is already paid or processed.
   */
  async generateForUser(userId: string, month: string, actorId: string): Promise<'created' | 'refreshed' | 'skipped'> {
    const existing = await this.model.findOne({ userId: new Types.ObjectId(userId), month }).lean();

    // Only skip if admin has already processed/paid it — don't overwrite manual edits
    if (existing && existing.status !== PayrollStatus.Draft) return 'skipped';

    const data = await this.buildPayrollData(userId, month, actorId);
    if (!data) return 'skipped';

    if (existing) {
      // Refresh draft with latest salary/allowances from user profile.
      // Preserve manually-entered incentives and additionalDeductions; include them in netPay.
      const existingIncentivesTotal = (existing.incentives ?? []).reduce((s, i) => s + (i as any).amount, 0);
      const existingAddlTotal = ((existing as any).additionalDeductions ?? []).reduce((s: number, d: any) => s + d.amount, 0);
      const refreshedNetPay = Math.max(0, data.grossPay + existingIncentivesTotal - existingAddlTotal);
      await this.model.findByIdAndUpdate(existing._id, {
        $set: {
          basicSalary:      data.basicSalary,
          hra:              data.hra,
          travelAllowance:  data.travelAllowance,
          da:               data.da,
          medicalAllowance: data.medicalAllowance,
          otherAllowance:   data.otherAllowance,
          workingDaysInMonth: data.workingDaysInMonth,
          presentDays: data.presentDays, halfDays: data.halfDays,
          absentDays:  data.absentDays,  leaveDays: data.leaveDays,
          paidLeaveDays: data.paidLeaveDays, lwpDays: data.lwpDays,
          reimbursementTotal: data.reimbursementTotal,
          lopDeduction: data.lopDeduction,
          grossPay: data.grossPay,
          netPay: refreshedNetPay,
          processedBy: data.processedBy,
        },
      });
      return 'refreshed';
    }

    await this.model.create({ ...data, incentives: [], status: PayrollStatus.Draft });
    return 'created';
  }

  /** Generate/refresh payroll for all active users for a given month. */
  async generateAll(month: string, actor: AuthUser): Promise<{ generated: number; refreshed: number; skipped: number }> {
    const users = await this.userModel.find({ isActive: true }).lean();
    let generated = 0; let refreshed = 0; let skipped = 0;
    for (const u of users) {
      const result = await this.generateForUser(String(u._id), month, actor.id);
      if (result === 'created')   generated++;
      else if (result === 'refreshed') refreshed++;
      else skipped++;
    }
    return { generated, refreshed, skipped };
  }

  /** Overview: all active users with their payroll, attendance summary, and case stats. */
  async overview(month: string): Promise<any[]> {
    const [users, payrolls, caseStats] = await Promise.all([
      this.userModel.find({ isActive: true }).lean(),
      this.model.find({ month }).lean(),
      // Aggregate case stats per assigned user (all-time counts)
      this.caseModel.aggregate([
        { $match: { assignedTo: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$assignedTo',
            total:     { $sum: 1 },
            disbursed: { $sum: { $cond: [{ $eq: ['$status', CaseStatus.Disbursed] }, 1, 0] } },
            rejected:  { $sum: { $cond: [{ $eq: ['$status', CaseStatus.Rejected] },  1, 0] } },
            inProgress:{ $sum: { $cond: [{ $and: [
              { $ne: ['$status', CaseStatus.Disbursed] },
              { $ne: ['$status', CaseStatus.Rejected] },
            ]}, 1, 0] } },
          },
        },
      ]),
    ]);

    const payrollMap = new Map(payrolls.map((p) => [String(p.userId), p]));
    const caseMap = new Map(caseStats.map((c: any) => [String(c._id), c]));

    // Get attendance summaries for this month per user in one query
    const attendanceSummary = await this.attendanceModel.aggregate([
      { $match: { date: { $regex: `^${month}` } } },
      {
        $group: {
          _id: '$userId',
          present:  { $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.Present] },  1, 0] } },
          halfDay:  { $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.HalfDay] },   1, 0] } },
          absent:   { $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.Absent] },    1, 0] } },
          onLeave:  { $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.OnLeave] },   1, 0] } },
        },
      },
    ]);
    const attMap = new Map(attendanceSummary.map((a: any) => [String(a._id), a]));

    return users.map((u) => {
      const uid = String(u._id);
      const att = attMap.get(uid) ?? { present: 0, halfDay: 0, absent: 0, onLeave: 0 };
      const cs  = caseMap.get(uid) ?? { total: 0, disbursed: 0, rejected: 0, inProgress: 0 };
      return {
        user: {
          _id: uid,
          firstName: u.firstName, lastName: u.lastName,
          role: u.role, designation: u.designation,
          employeeCode: u.employeeCode,
          basicSalary: u.basicSalary ?? 0,
        },
        payroll: payrollMap.get(uid) ?? null,
        attendance: { present: att.present, halfDay: att.halfDay, absent: att.absent, onLeave: att.onLeave },
        cases: { total: cs.total, disbursed: cs.disbursed, rejected: cs.rejected, inProgress: cs.inProgress },
      };
    });
  }
}
