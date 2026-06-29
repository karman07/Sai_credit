import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InsuranceMIS } from '../insurance-mis/schemas/insurance-mis.schema';
import { LoanCase } from '../cases/schemas/case.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AttendanceService } from '../attendance/attendance.service';
import { CaseStatus } from '../common/enums';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    @InjectModel(InsuranceMIS.name) private readonly insuranceModel: Model<InsuranceMIS>,
    @InjectModel(LoanCase.name) private readonly casesModel: Model<LoanCase>,
    private readonly notifications: NotificationsService,
    private readonly attendanceSvc: AttendanceService,
  ) {}

  /** Daily at 8 AM — fire reminders for insurance records due today. */
  @Cron('0 8 * * *')
  async insuranceReminders() {
    this.logger.log('Running insurance reminder job…');
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const due = await this.insuranceModel.find({
      reminderDate: { $gte: todayStart, $lte: todayEnd },
      isActive: true,
    }).lean();

    for (const rec of due) {
      if (!rec.createdBy) continue;
      const endStr = rec.endDate ? new Date(rec.endDate).toLocaleDateString('en-IN') : '—';
      await this.notifications.notify({
        userId: String(rec.createdBy),
        type: 'insurance_reminder',
        title: `Insurance Reminder — ${rec.customerName ?? rec.caseCode ?? 'Unknown'}`,
        message: `Policy for ${rec.caseCode ?? 'case'} expires on ${endStr}. Action required.`,
        caseId: rec.caseId ? String(rec.caseId) : undefined,
        caseCode: rec.caseCode,
      });
    }
    this.logger.log(`Insurance reminders sent: ${due.length}`);
  }

  /** Daily at 9 AM — alert on cases with no status change in 7 days. */
  @Cron('0 9 * * *')
  async stagnantCaseAlerts() {
    this.logger.log('Running stagnant case job…');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeStatuses = [CaseStatus.Sales, CaseStatus.Pending, CaseStatus.InCredit, CaseStatus.Incomplete];

    const stagnant = await this.casesModel.find({
      isActive: true,
      status: { $in: activeStatuses },
      updatedAt: { $lte: sevenDaysAgo },
      assignedTo: { $exists: true },
    }).lean();

    for (const c of stagnant) {
      if (!c.assignedTo) continue;
      await this.notifications.notify({
        userId: String(c.assignedTo),
        type: 'stagnant_case',
        title: `Case Stagnant — ${c.customer?.firstName ?? ''} ${c.customer?.lastName ?? ''}`.trim(),
        message: `${c.caseCode} has had no update in 7+ days. Current status: ${c.status}.`,
        caseId: String(c._id),
        caseCode: c.caseCode,
      });
    }
    this.logger.log(`Stagnant alerts sent: ${stagnant.length}`);
  }

  /** Daily at 11:30 PM — auto-mark absent for today's unrecorded working days. */
  @Cron('30 23 * * *')
  async dailyAutoMarkAbsent() {
    const today = new Date().toISOString().slice(0, 10);
    this.logger.log(`Running daily auto-mark-absent for ${today}…`);
    const result = await this.attendanceSvc.autoMarkAbsent(today, 'system');
    this.logger.log(`Auto-mark absent done — ${result.marked} absent, ${result.skipped} skipped`);
  }
}
