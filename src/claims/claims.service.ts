import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Claim } from './schemas/claim.schema';
import { User } from '../users/schemas/user.schema';
import { ClaimStatus, isSelfServiceRole, UserRole, ADMIN_PORTAL_ROLES } from '../common/enums';
import { AuthUser } from '../common/types';
import { CreateClaimDto, ReviewClaimDto } from './claims.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ClaimsService {
  constructor(
    @InjectModel(Claim.name) private readonly model: Model<Claim>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notifSvc: NotificationsService,
    private readonly mail: MailService,
  ) {}

  async create(actor: AuthUser, dto: CreateClaimDto) {
    const claim = await this.model.create({
      userId: new Types.ObjectId(actor.id),
      ...dto,
    });

    this.notifyClaimSubmitted(claim, actor);

    return claim;
  }

  /** Emails admins + the staff member's coordinator that a claim was submitted (non-blocking). */
  private notifyClaimSubmitted(claim: Claim, actor: AuthUser) {
    const typeLabel = claim.type.charAt(0).toUpperCase() + claim.type.slice(1);
    const amtFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(claim.amount);
    const vars = {
      staffName: `${actor.firstName} ${actor.lastName}`.trim(),
      claimType: typeLabel,
      amount: amtFmt,
      month: claim.month,
      description: claim.description,
    };

    this.userModel
      .find({ role: { $in: ADMIN_PORTAL_ROLES }, isActive: true }, 'email')
      .lean()
      .then(async (admins) => {
        const recipients = admins.map((u) => u.email);
        const creator = await this.userModel.findById(actor.id, 'coordinatorId').lean();
        if (creator?.coordinatorId) {
          const coordinator = await this.userModel.findById(creator.coordinatorId, 'email').lean();
          if (coordinator?.email) recipients.push(coordinator.email);
        }
        return this.mail.sendTemplate('claim_submitted', vars, recipients);
      })
      .catch(() => { /* non-blocking — don't fail claim creation */ });
  }

  async list(actor: AuthUser, query: { userId?: string; month?: string; status?: string; page?: number; limit?: number }) {
    const isAdmin = !isSelfServiceRole(actor.role as UserRole);
    const filter: Record<string, any> = {};

    if (isAdmin && query.userId) {
      filter.userId = new Types.ObjectId(query.userId);
    } else if (!isAdmin) {
      filter.userId = new Types.ObjectId(actor.id);
    }

    if (query.month) filter.month = query.month;
    if (query.status) filter.status = query.status;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const [claims, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('userId', 'firstName lastName employeeCode role')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return { claims, total, page, limit };
  }

  async findById(id: string, actor: AuthUser) {
    const claim = await this.model.findById(id)
      .populate('userId', 'firstName lastName employeeCode role')
      .populate('reviewedBy', 'firstName lastName')
      .lean();
    if (!claim) throw new NotFoundException('Claim not found');
    const isAdmin = !isSelfServiceRole(actor.role as UserRole);
    if (!isAdmin && String(claim.userId) !== actor.id) {
      throw new ForbiddenException('Access denied');
    }
    return claim;
  }

  async review(id: string, dto: ReviewClaimDto, actor: AuthUser) {
    const claim = await this.model.findById(id);
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== ClaimStatus.Pending) {
      throw new ForbiddenException('Only pending claims can be reviewed');
    }
    claim.status = dto.status;
    claim.reviewNote = dto.reviewNote;
    claim.reviewedBy = new Types.ObjectId(actor.id);
    claim.reviewedAt = new Date();
    await claim.save();

    // Notify the employee about the decision
    const approved = dto.status === ClaimStatus.Approved;
    const typeLabel = claim.type.charAt(0).toUpperCase() + claim.type.slice(1);
    const amtFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(claim.amount);
    await this.notifSvc.notify({
      userId: String(claim.userId),
      type: approved ? 'claim_approved' : 'claim_rejected',
      title: approved ? 'Reimbursement Approved' : 'Reimbursement Rejected',
      message: approved
        ? `Your ${typeLabel} claim of ${amtFmt} for ${claim.month} has been approved and will be added to your salary.${dto.reviewNote ? ' Note: ' + dto.reviewNote : ''}`
        : `Your ${typeLabel} claim of ${amtFmt} for ${claim.month} was rejected.${dto.reviewNote ? ' Reason: ' + dto.reviewNote : ''}`,
    });

    return claim;
  }

  async cancel(id: string, actor: AuthUser) {
    const claim = await this.model.findById(id);
    if (!claim) throw new NotFoundException('Claim not found');
    if (String(claim.userId) !== actor.id) throw new ForbiddenException('Access denied');
    if (claim.status !== ClaimStatus.Pending) throw new ForbiddenException('Only pending claims can be cancelled');
    await this.model.findByIdAndDelete(id);
    return { ok: true };
  }

  async uploadReceipt(id: string, receiptUrl: string, actor: AuthUser) {
    const claim = await this.model.findById(id);
    if (!claim) throw new NotFoundException('Claim not found');
    const isAdmin = !isSelfServiceRole(actor.role as UserRole);
    if (!isAdmin && String(claim.userId) !== actor.id) {
      throw new ForbiddenException('Access denied');
    }
    claim.receiptUrl = receiptUrl;
    return claim.save();
  }

  async approvedTotalForMonth(userId: string, month: string): Promise<number> {
    const result = await this.model.aggregate([
      { $match: { userId: new Types.ObjectId(userId), month, status: ClaimStatus.Approved } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total ?? 0;
  }
}
