import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InsuranceMIS } from './schemas/insurance-mis.schema';
import { CreateInsuranceMISDto, UpdateInsuranceMISDto } from './insurance-mis.dto';
import { AuthUser } from '../common/types';
import { User } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { ADMIN_PORTAL_ROLES } from '../common/enums';

@Injectable()
export class InsuranceMISService {
  constructor(
    @InjectModel(InsuranceMIS.name) private readonly model: Model<InsuranceMIS>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly mail: MailService,
  ) {}

  async list(expiryFilter?: string, mine?: boolean, actorId?: string) {
    const filter: Record<string, any> = { isActive: true };
    if (expiryFilter) {
      const now = new Date();
      const days = parseInt(expiryFilter, 10);
      const cutoff = new Date(now.getTime() + days * 86400000);
      filter.endDate = { $lte: cutoff };
    }
    if (mine && actorId) {
      filter.createdBy = new Types.ObjectId(actorId);
    }
    return this.model.find(filter).sort({ endDate: 1 }).lean();
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Insurance record not found');
    return doc;
  }

  async create(dto: CreateInsuranceMISDto, actor: AuthUser) {
    const endorsement = dto.endorsement
      ? { date: dto.endorsement.date ? new Date(dto.endorsement.date) : undefined, note: dto.endorsement.note }
      : undefined;
    return this.model.create({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      reminderDate: dto.reminderDate ? new Date(dto.reminderDate) : undefined,
      endorsement,
      createdBy: actor.id,
      createdByName: `${actor.firstName} ${actor.lastName}`,
    });
  }

  async update(id: string, dto: UpdateInsuranceMISDto, actor: AuthUser) {
    const existing = await this.model.findById(id).lean();
    if (!existing) throw new NotFoundException('Insurance record not found');

    const setFields: Record<string, any> = { ...dto };
    if (dto.startDate) setFields.startDate = new Date(dto.startDate);
    if (dto.endDate) setFields.endDate = new Date(dto.endDate);
    if (dto.reminderDate) setFields.reminderDate = new Date(dto.reminderDate);
    if (dto.endorsement) {
      setFields.endorsement = {
        date: dto.endorsement.date ? new Date(dto.endorsement.date) : undefined,
        note: dto.endorsement.note,
      };
    }

    // A renewal is any update that extends the policy's end date beyond its previous one.
    const isRenewal = !!(
      setFields.endDate && existing.endDate &&
      setFields.endDate.getTime() > new Date(existing.endDate).getTime()
    );

    const mongoUpdate: Record<string, any> = { $set: setFields };
    if (isRenewal) {
      setFields.lastRenewedAt = new Date();
      mongoUpdate.$push = {
        renewalHistory: {
          renewedAt: setFields.lastRenewedAt,
          oldEndDate: existing.endDate,
          newEndDate: setFields.endDate,
          renewedBy: actor.id,
          renewedByName: `${actor.firstName} ${actor.lastName}`.trim(),
        },
      };
    }

    const doc = await this.model.findByIdAndUpdate(id, mongoUpdate, { new: true }).lean();
    if (!doc) throw new NotFoundException('Insurance record not found');

    if (isRenewal) {
      this.notifyRenewed(doc, existing.endDate, actor);
    }

    return doc;
  }

  /** Emails admins + the record's coordinator (and the customer, if we have their email) about a renewal. Non-blocking. */
  private notifyRenewed(doc: InsuranceMIS, oldEndDate: Date, actor: AuthUser) {
    const vars = {
      customerName: doc.customerName ?? doc.insuredName ?? 'the customer',
      policyLabel: doc.caseCode ?? doc.policyName ?? 'the policy',
      insurer: doc.insurer,
      oldEndDate: new Date(oldEndDate).toLocaleDateString('en-IN'),
      newEndDate: new Date(doc.endDate).toLocaleDateString('en-IN'),
      renewedByName: `${actor.firstName} ${actor.lastName}`.trim(),
    };

    this.userModel
      .find({ role: { $in: ADMIN_PORTAL_ROLES }, isActive: true }, 'email')
      .lean()
      .then(async (admins) => {
        const recipients: (string | undefined | null)[] = [doc.customerEmail, ...admins.map((u) => u.email)];
        if (doc.createdBy) {
          const creator = await this.userModel.findById(doc.createdBy, 'coordinatorId').lean();
          if (creator?.coordinatorId) {
            const coordinator = await this.userModel.findById(creator.coordinatorId, 'email').lean();
            if (coordinator?.email) recipients.push(coordinator.email);
          }
        }
        return this.mail.sendTemplate('insurance_policy_renewed', vars, recipients);
      })
      .catch(() => { /* non-blocking — don't fail the update */ });
  }

  /** Sales/coordinator flag a policy as needing renewal — no term changes, just an actionable alert to admin + coordinator. */
  async requestRenewal(id: string, actor: AuthUser) {
    const doc = await this.model.findByIdAndUpdate(id, { renewal: true }, { new: true }).lean();
    if (!doc) throw new NotFoundException('Insurance record not found');
    this.notifyRenewalRequested(doc, actor);
    return doc;
  }

  private notifyRenewalRequested(doc: InsuranceMIS, actor: AuthUser) {
    const vars = {
      staffName: `${actor.firstName} ${actor.lastName}`.trim(),
      customerName: doc.customerName ?? doc.insuredName ?? 'the customer',
      policyLabel: doc.caseCode ?? doc.policyName ?? 'the policy',
      insurer: doc.insurer,
      endDate: new Date(doc.endDate).toLocaleDateString('en-IN'),
    };

    this.userModel
      .find({ role: { $in: ADMIN_PORTAL_ROLES }, isActive: true }, 'email')
      .lean()
      .then(async (admins) => {
        const recipients: (string | undefined | null)[] = admins.map((u) => u.email);
        if (doc.createdBy) {
          const creator = await this.userModel.findById(doc.createdBy, 'coordinatorId').lean();
          if (creator?.coordinatorId) {
            const coordinator = await this.userModel.findById(creator.coordinatorId, 'email').lean();
            if (coordinator?.email) recipients.push(coordinator.email);
          }
        }
        return this.mail.sendTemplate('insurance_renewal_requested', vars, recipients);
      })
      .catch(() => { /* non-blocking — don't fail the request */ });
  }

  async delete(id: string) {
    await this.model.findByIdAndUpdate(id, { isActive: false });
    return { id };
  }
}
