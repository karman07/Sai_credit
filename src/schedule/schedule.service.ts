import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InsuranceMIS } from '../insurance-mis/schemas/insurance-mis.schema';
import { LoanCase } from '../cases/schemas/case.schema';
import { User } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AttendanceService } from '../attendance/attendance.service';
import { MailService } from '../mail/mail.service';
import { CaseStatus, ADMIN_PORTAL_ROLES } from '../common/enums';

/** Days-before-expiry milestones at which an insurance policy expiry email is sent. */
const EXPIRY_EMAIL_MILESTONES = [30, 15, 7, 1];

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    @InjectModel(InsuranceMIS.name) private readonly insuranceModel: Model<InsuranceMIS>,
    @InjectModel(LoanCase.name) private readonly casesModel: Model<LoanCase>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notifications: NotificationsService,
    private readonly attendanceSvc: AttendanceService,
    private readonly mail: MailService,
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

  /** Daily at 8:15 AM — email expiry reminders at 30/15/7/1 days before a policy's endDate. */
  @Cron('15 8 * * *')
  async insuranceExpiryEmailReminders() {
    this.logger.log('Running insurance expiry email job…');
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const admins = await this.userModel.find({ role: { $in: ADMIN_PORTAL_ROLES }, isActive: true }, 'email').lean();
    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    let sent = 0;
    for (const daysLeft of EXPIRY_EMAIL_MILESTONES) {
      const target = new Date(today); target.setDate(target.getDate() + daysLeft);
      const nextDay = new Date(target); nextDay.setDate(nextDay.getDate() + 1);

      const due = await this.insuranceModel.find({
        isActive: true,
        endDate: { $gte: target, $lt: nextDay },
      }).lean();

      for (const rec of due) {
        const endStr = new Date(rec.endDate).toLocaleDateString('en-IN');
        const who = rec.customerName ?? rec.insuredName ?? 'the customer';
        const label = rec.caseCode ?? rec.policyName ?? 'the policy';

        let creatorEmail: string | undefined;
        let coordinatorEmail: string | undefined;
        if (rec.createdBy) {
          const creator = await this.userModel.findById(rec.createdBy, 'email coordinatorId').lean();
          creatorEmail = creator?.email;
          if (creator?.coordinatorId) {
            const coordinator = await this.userModel.findById(creator.coordinatorId, 'email').lean();
            coordinatorEmail = coordinator?.email;
          }
        }

        const recipients = [rec.customerEmail, creatorEmail, coordinatorEmail, ...adminEmails];
        await this.mail.sendTemplate(
          'insurance_expiry_reminder',
          { customerName: who, policyLabel: label, insurer: rec.insurer, endDate: endStr, daysLeft },
          recipients,
        );
        sent++;
      }
    }
    this.logger.log(`Insurance expiry emails sent: ${sent}`);
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
