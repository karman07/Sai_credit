import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MailTemplate } from './schemas/mail-template.schema';
import { UpdateMailTemplateDto } from './mail-templates.dto';
import { AuthUser } from '../common/types';

interface DefaultTemplate {
  key: string;
  name: string;
  description: string;
  variables: string[];
  subject: string;
  html: string;
}

/** Seeded once per key on boot — never overwritten afterwards, so admin edits persist across restarts. */
const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    key: 'case_created',
    name: 'New Case Added',
    description: 'Sent to admins and the case creator\'s coordinator when a new case is added.',
    variables: ['caseCode', 'customerName', 'createdByName', 'status'],
    subject: 'New Case Added — {{caseCode}}',
    html:
      '<p>Hi,</p>' +
      '<p><b>{{createdByName}}</b> created a new case <b>{{caseCode}}</b> for <b>{{customerName}}</b>.</p>' +
      '<p>Status: {{status}}</p>' +
      '<p>— Sai Credit CRM</p>',
  },
  {
    key: 'case_status_changed',
    name: 'Case Status Changed',
    description: 'Sent to admins and the case\'s coordinator whenever a case moves to a new status.',
    variables: ['caseCode', 'customerName', 'oldStatus', 'newStatus', 'changedByName', 'note'],
    subject: 'Case Status Updated — {{caseCode}}: {{oldStatus}} → {{newStatus}}',
    html:
      '<p>Hi,</p>' +
      '<p>Case <b>{{caseCode}}</b> for <b>{{customerName}}</b> moved from <b>{{oldStatus}}</b> to <b>{{newStatus}}</b>.</p>' +
      '<p>Changed by: {{changedByName}}</p>' +
      '<p>Note: {{note}}</p>' +
      '<p>— Sai Credit CRM</p>',
  },
  {
    key: 'case_updated',
    name: 'Case Updated',
    description: 'Sent to admins, the case\'s coordinator, and the assigned sales rep whenever a case is edited or reassigned.',
    variables: ['caseCode', 'customerName', 'changeDescription', 'changedByName'],
    subject: 'Case Updated — {{caseCode}}',
    html:
      '<p>Hi,</p>' +
      '<p>Case <b>{{caseCode}}</b> for <b>{{customerName}}</b> was updated.</p>' +
      '<p>Change: {{changeDescription}}</p>' +
      '<p>Updated by: {{changedByName}}</p>' +
      '<p>— Sai Credit CRM</p>',
  },
  {
    key: 'insurance_policy_renewed',
    name: 'Insurance Policy Renewed',
    description: 'Sent to the customer, admins, and the policy\'s coordinator whenever a policy\'s end date is extended (renewed).',
    variables: ['customerName', 'policyLabel', 'insurer', 'oldEndDate', 'newEndDate', 'renewedByName'],
    subject: 'Insurance Policy Renewed — {{customerName}}',
    html:
      '<p>Hi,</p>' +
      '<p>The insurance policy for <b>{{customerName}}</b> ({{policyLabel}}) with <b>{{insurer}}</b> has been <b>renewed</b>.</p>' +
      '<p>Coverage extended from <b>{{oldEndDate}}</b> to <b>{{newEndDate}}</b>.</p>' +
      '<p>Renewed by: {{renewedByName}}</p>' +
      '<p>— Sai Credit CRM</p>',
  },
  {
    key: 'insurance_renewal_requested',
    name: 'Insurance Renewal Requested',
    description: 'Sent to admins and the policy\'s coordinator when a sales/coordinator user flags a policy as needing renewal.',
    variables: ['staffName', 'customerName', 'policyLabel', 'insurer', 'endDate'],
    subject: 'Renewal Requested — {{customerName}}',
    html:
      '<p>Hi,</p>' +
      '<p><b>{{staffName}}</b> has requested renewal for <b>{{customerName}}</b>\'s policy ({{policyLabel}}) with <b>{{insurer}}</b>, expiring <b>{{endDate}}</b>.</p>' +
      '<p>Please process the renewal.</p>' +
      '<p>— Sai Credit CRM</p>',
  },
  {
    key: 'claim_submitted',
    name: 'Reimbursement Claim Submitted',
    description: 'Sent to admins and the staff member\'s coordinator when a reimbursement claim is submitted.',
    variables: ['staffName', 'claimType', 'amount', 'month', 'description'],
    subject: 'New Reimbursement Claim — {{staffName}}',
    html:
      '<p>Hi,</p>' +
      '<p><b>{{staffName}}</b> submitted a <b>{{claimType}}</b> reimbursement claim of <b>{{amount}}</b> for {{month}}.</p>' +
      '<p>Description: {{description}}</p>' +
      '<p>— Sai Credit CRM</p>',
  },
  {
    key: 'leave_applied',
    name: 'Leave Application Submitted',
    description: 'Sent to admins and the staff member\'s coordinator when a leave application is submitted.',
    variables: ['staffName', 'leaveType', 'dateRange', 'totalDays', 'reason'],
    subject: 'New Leave Application — {{staffName}}',
    html:
      '<p>Hi,</p>' +
      '<p><b>{{staffName}}</b> applied for <b>{{leaveType}}</b> leave ({{totalDays}} day(s)) from <b>{{dateRange}}</b>.</p>' +
      '<p>Reason: {{reason}}</p>' +
      '<p>— Sai Credit CRM</p>',
  },
  {
    key: 'insurance_expiry_reminder',
    name: 'Insurance Expiry Reminder',
    description: 'Sent to the customer, the policy creator, and admins at 30/15/7/1 days before a policy\'s end date.',
    variables: ['customerName', 'policyLabel', 'insurer', 'endDate', 'daysLeft'],
    subject: 'Insurance Expiring in {{daysLeft}} Day(s) — {{customerName}}',
    html:
      '<p>Hi,</p>' +
      '<p>The insurance policy for <b>{{customerName}}</b> ({{policyLabel}}) with <b>{{insurer}}</b> expires on <b>{{endDate}}</b> — {{daysLeft}} day(s) from now.</p>' +
      '<p>Please take the necessary renewal action.</p>' +
      '<p>— Sai Credit CRM</p>',
  },
];

@Injectable()
export class MailTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(MailTemplatesService.name);

  constructor(@InjectModel(MailTemplate.name) private readonly model: Model<MailTemplate>) {}

  async onModuleInit() {
    let inserted = 0;
    for (const tpl of DEFAULT_TEMPLATES) {
      const exists = await this.model.exists({ key: tpl.key });
      if (exists) continue;
      await this.model.create({ ...tpl, isActive: true });
      inserted++;
    }
    this.logger.log(`Mail templates ready (${inserted} new, ${DEFAULT_TEMPLATES.length - inserted} already present)`);
  }

  list() {
    return this.model.find().sort({ name: 1 }).lean();
  }

  async getByKey(key: string) {
    const doc = await this.model.findOne({ key }).lean();
    if (!doc) throw new NotFoundException(`Mail template not found: ${key}`);
    return doc;
  }

  async update(key: string, dto: UpdateMailTemplateDto, actor: AuthUser) {
    const doc = await this.model.findOneAndUpdate(
      { key },
      { ...dto, updatedBy: actor.id },
      { new: true },
    ).lean();
    if (!doc) throw new NotFoundException(`Mail template not found: ${key}`);
    return doc;
  }
}
