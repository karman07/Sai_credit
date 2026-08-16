import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { LoanCase, pipelineStagesFor } from './schemas/case.schema';
import {
  CreateCaseDto, UpdateCaseDto, UpdateCaseStatusDto,
  AssignCaseDto, RequestDocsDto, UploadDocDto, EditDocDto,
  UpdatePipelineStageDto,
} from './cases.dto';
import { ActivityType, CaseStatus, isSalesRole, MasterType, ADMIN_PORTAL_ROLES, UserRole } from '../common/enums';
import { AuthUser } from '../common/types';
import { CounterService } from '../common/counter/counter.service';
import { ActivitiesService } from '../activities/activities.service';
import { BanksService } from '../banks/banks.service';
import { DealersService } from '../dealers/dealers.service';
import { CustomersService } from '../customers/customers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/schemas/user.schema';
import { Master } from '../masters/schemas/master.schema';
import { MailService } from '../mail/mail.service';

@Injectable()
export class CasesService {
  constructor(
    @InjectModel(LoanCase.name) private readonly model: Model<LoanCase>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Master.name) private readonly masterModel: Model<Master>,
    private readonly counter: CounterService,
    private readonly activities: ActivitiesService,
    private readonly banks: BanksService,
    private readonly dealers: DealersService,
    private readonly customersService: CustomersService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Looks up the case-code prefix for a product from the `products` master; falls back to 'CASE'. */
  private async resolveProductPrefix(product?: string): Promise<string> {
    if (!product) return 'CASE';
    const m = await this.masterModel
      .findOne({ type: MasterType.Product, name: product, isActive: true }, 'code')
      .lean();
    return m?.code?.toUpperCase() ?? 'CASE';
  }

  async list(params: {
    page?: number; limit?: number; search?: string; status?: string;
    bankId?: string; dealerId?: string; product?: string; firm?: string;
    assignedTo?: string; userId?: string; scopeToUser?: boolean; coordinatorId?: string;
  }) {
    const { page = 1, limit = 25, search, status, bankId, dealerId, product, firm, assignedTo, userId, scopeToUser, coordinatorId } = params;
    const filter: Record<string, any> = { isActive: true };

    // Coordinators only see cases assigned to the sales reps assigned to them
    if (coordinatorId) {
      const reps = await this.userModel.find({ coordinatorId: new Types.ObjectId(coordinatorId) }, '_id').lean();
      filter.assignedTo = { $in: reps.map((r) => r._id) };
    } else if (scopeToUser && userId) {
      // Sales users see cases they created OR were assigned to
      const uid = new Types.ObjectId(userId);
      filter.$or = [{ createdBy: uid }, { assignedTo: uid }];
    }

    if (search) {
      const re = new RegExp(search, 'i');
      const searchOr = [{ caseCode: re }, { 'customer.firstName': re }, { 'customer.lastName': re }, { 'customer.contact': re }];
      if (filter.$or) {
        // Combine with existing $or using $and
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    if (assignedTo) filter.assignedTo = new Types.ObjectId(assignedTo);
    if (status && status !== 'All') filter.status = status;
    if (bankId) filter.bankId = new Types.ObjectId(bankId);
    if (dealerId) filter.dealerId = new Types.ObjectId(dealerId);
    if (product) filter.product = product;
    if (firm) filter.firm = firm;

    const total = await this.model.countDocuments(filter);
    const data = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string, actor?: AuthUser) {
    const doc = await this.model.findOne({ _id: id, isActive: true }).lean();
    if (!doc) throw new NotFoundException('Case not found');
    if (actor) await this.assertCanAccessCase(actor, doc);
    return doc;
  }

  /**
   * Coordinators may only touch cases assigned to a sales rep assigned to them.
   * Sales-role users (executives, telecallers, RMs) may only touch cases they created or are assigned to.
   */
  private async assertCanAccessCase(actor: AuthUser, existing: { assignedTo?: Types.ObjectId; createdBy?: Types.ObjectId }) {
    if (actor.role === UserRole.Coordinator) {
      if (!existing.assignedTo) throw new ForbiddenException('You do not have access to this case');
      const rep = await this.userModel.findById(existing.assignedTo).select('coordinatorId').lean();
      if (!rep?.coordinatorId || String(rep.coordinatorId) !== actor.id) {
        throw new ForbiddenException('You do not have access to this case');
      }
      return;
    }

    if (isSalesRole(actor.role)) {
      const owns = String(existing.createdBy) === actor.id || (!!existing.assignedTo && String(existing.assignedTo) === actor.id);
      if (!owns) throw new ForbiddenException('You do not have access to this case');
    }
  }

  /** Looks up the coordinator overseeing a given sales rep, for denormalizing onto the case. */
  private async resolveCoordinator(assigneeId: Types.ObjectId): Promise<{ coordinatorId?: Types.ObjectId; coordinatorName?: string }> {
    const rep = await this.userModel.findById(assigneeId, 'coordinatorId').lean();
    if (!rep?.coordinatorId) return {};
    const coordinator = await this.userModel.findById(rep.coordinatorId, 'firstName lastName').lean();
    if (!coordinator) return {};
    return { coordinatorId: rep.coordinatorId, coordinatorName: `${coordinator.firstName} ${coordinator.lastName}`.trim() };
  }

  /** Admins + the case's coordinator + the assigned sales rep + the fixed ops CC address. */
  private async caseNotificationRecipients(coordinatorId?: Types.ObjectId, assignedTo?: Types.ObjectId): Promise<string[]> {
    const admins = await this.userModel
      .find({ role: { $in: ADMIN_PORTAL_ROLES }, isActive: true }, 'email')
      .lean();
    const recipients = admins.map((u) => u.email);

    const extraEmail = this.config.get<string>('notify.caseUpdatesEmail');
    if (extraEmail) recipients.push(extraEmail);

    if (coordinatorId) {
      const coordinator = await this.userModel.findById(coordinatorId, 'email').lean();
      if (coordinator?.email) recipients.push(coordinator.email);
    }
    if (assignedTo) {
      const rep = await this.userModel.findById(assignedTo, 'email').lean();
      if (rep?.email) recipients.push(rep.email);
    }
    return recipients;
  }

  /** Emails admins + coordinator + sales rep whenever a case's status changes (non-blocking). */
  private notifyStatusChanged(params: {
    caseCode: string;
    customerName?: string;
    coordinatorId?: Types.ObjectId;
    assignedTo?: Types.ObjectId;
    oldStatus: string;
    newStatus: string;
    note?: string;
    actor: AuthUser;
  }) {
    const { caseCode, customerName, coordinatorId, assignedTo, oldStatus, newStatus, note, actor } = params;
    const vars = {
      caseCode,
      customerName: customerName?.trim() || '—',
      oldStatus, newStatus,
      changedByName: `${actor.firstName} ${actor.lastName}`.trim(),
      note: note?.trim() || '—',
    };

    this.caseNotificationRecipients(coordinatorId, assignedTo)
      .then((recipients) => this.mail.sendTemplate('case_status_changed', vars, recipients))
      .catch(() => { /* non-blocking — don't fail the status-changing action */ });
  }

  /** Emails admins + coordinator + sales rep whenever a case is edited or reassigned (non-blocking). */
  private notifyCaseUpdated(params: {
    caseCode: string;
    customerName?: string;
    coordinatorId?: Types.ObjectId;
    assignedTo?: Types.ObjectId;
    changeDescription: string;
    actor: AuthUser;
  }) {
    const { caseCode, customerName, coordinatorId, assignedTo, changeDescription, actor } = params;
    const vars = {
      caseCode,
      customerName: customerName?.trim() || '—',
      changeDescription,
      changedByName: `${actor.firstName} ${actor.lastName}`.trim(),
    };

    this.caseNotificationRecipients(coordinatorId, assignedTo)
      .then((recipients) => this.mail.sendTemplate('case_updated', vars, recipients))
      .catch(() => { /* non-blocking — don't fail the update */ });
  }

  async create(dto: CreateCaseDto, actor: AuthUser) {
    const status = dto.status ?? CaseStatus.Sales;

    if (status === CaseStatus.Draft) {
      if (!dto.customer?.firstName || dto.customer.firstName.trim().length === 0) {
        throw new BadRequestException('First Name (or name) is required to save draft');
      }
      if (!dto.customer?.contact || dto.customer.contact.trim().length === 0) {
        throw new BadRequestException('Contact number is required to save draft');
      }
      if (!dto.dealerId) {
        throw new BadRequestException('Dealer is required to save draft');
      }
    } else {
      if (!dto.customer?.firstName || dto.customer.firstName.trim().length === 0) {
        throw new BadRequestException('First Name is required');
      }
      if (!dto.customer?.lastName || dto.customer.lastName.trim().length === 0) {
        throw new BadRequestException('Last Name is required');
      }
      if (!dto.customer?.contact || dto.customer.contact.trim().length === 0) {
        throw new BadRequestException('Contact number is required');
      }
      if (!dto.customer?.location || dto.customer.location.trim().length === 0) {
        throw new BadRequestException('Location is required');
      }
      if (!dto.product) {
        throw new BadRequestException('Product Type is required');
      }
      if (!dto.firm) {
        throw new BadRequestException('Firm is required');
      }
      if (!dto.loanAmount) {
        throw new BadRequestException('Loan Amount is required');
      }
      if (!dto.bankId) {
        throw new BadRequestException('Bank is required');
      }
      if (!dto.dealerId) {
        throw new BadRequestException('Dealer is required');
      }
    }

    const prefix = await this.resolveProductPrefix(dto.product);
    const caseCode = await this.counter.code(prefix, `case:${prefix.toLowerCase()}`);

    // Denormalize names for fast display
    let bankName: string | undefined;
    let dealerName: string | undefined;

    if (dto.bankId) {
      try { const b = await this.banks.findById(dto.bankId); bankName = b.name; } catch {}
    }
    if (dto.dealerId) {
      try { const d = await this.dealers.findById(dto.dealerId); dealerName = d.name; } catch {}
    }

    // Auto-assign to creator if they are a sales user
    let assignedTo: Types.ObjectId | undefined;
    let assignedToName: string | undefined;
    if (isSalesRole(actor.role)) {
      assignedTo = new Types.ObjectId(actor.id);
      assignedToName = `${actor.firstName} ${actor.lastName}`.trim();
    }

    const { coordinatorId, coordinatorName } = assignedTo
      ? await this.resolveCoordinator(assignedTo)
      : {};

    const created = await this.model.create({
      ...dto, status, caseCode, bankName, dealerName,
      assignedTo, assignedToName, coordinatorId, coordinatorName,
      createdBy: actor.id, isActive: true,
      documents: [], docRequests: [],
      pipeline: pipelineStagesFor(dto.product).map((stage) => ({ stage, status: 'Pending' })),
    });

    await this.activities.log({
      caseId: created._id, type: ActivityType.Created,
      description: `Case ${caseCode} created` + (status === CaseStatus.Draft ? ' as Draft' : ''), actor,
    });

    const customerName = [dto.customer?.firstName, dto.customer?.lastName].filter(Boolean).join(' ') || '—';
    const createdByName = `${actor.firstName} ${actor.lastName}`.trim();
    const caseCreatedMessage = `${createdByName} created case ${caseCode}${customerName !== '—' ? ` for ${customerName}` : ''}`;
    const caseCreatedMailVars = { caseCode, customerName, createdByName, status };

    // Notify + email all admin-portal users about the new case (non-blocking)
    this.userModel
      .find({ role: { $in: ADMIN_PORTAL_ROLES }, isActive: true }, '_id email')
      .lean()
      .then((admins) => {
        if (!admins.length) return;
        const adminIds = admins.map((u) => String(u._id));
        return Promise.all([
          this.notifications.notifyMany(adminIds, {
            type: 'new_case',
            title: 'New case added',
            message: caseCreatedMessage,
            caseCode,
            caseId: String(created._id),
          }),
          this.mail.sendTemplate('case_created', caseCreatedMailVars, admins.map((u) => u.email)),
        ]);
      })
      .catch(() => { /* non-blocking — don't fail case creation */ });

    // Notify + email the creator's assigned coordinator, if any (non-blocking)
    this.userModel
      .findById(actor.id, 'coordinatorId')
      .lean()
      .then(async (creator) => {
        if (!creator?.coordinatorId) return;
        const coordinator = await this.userModel.findById(creator.coordinatorId, 'email').lean();
        return Promise.all([
          this.notifications.notify({
            userId: String(creator.coordinatorId),
            type: 'new_case',
            title: 'New case added',
            message: caseCreatedMessage,
            caseCode,
            caseId: String(created._id),
          }),
          this.mail.sendTemplate('case_created', caseCreatedMailVars, coordinator?.email),
        ]);
      })
      .catch(() => { /* non-blocking — don't fail case creation */ });

    // Auto-create or update customer record from embedded case customer info
    if (dto.customer?.contact) {
      this.customersService.findOrCreateFromCase({
        phone: dto.customer.contact,
        firstName: dto.customer.firstName ?? '',
        lastName: dto.customer.lastName,
        alternatePhone: dto.customer.altContact,
        location: dto.customer.location,
        assignedTo: assignedTo ? String(assignedTo) : actor.id,
        createdBy: actor.id,
        caseCode,
        caseStatus: status,
      }).catch(() => { /* non-blocking — don't fail case creation */ });
    }

    return created.toObject();
  }

  async update(id: string, dto: UpdateCaseDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, existing);

    const merged = {
      customer: { ...existing.customer, ...dto.customer },
      product: dto.product !== undefined ? dto.product : existing.product,
      firm: dto.firm !== undefined ? dto.firm : existing.firm,
      loanAmount: dto.loanAmount !== undefined ? dto.loanAmount : existing.loanAmount,
      bankId: dto.bankId !== undefined ? dto.bankId : existing.bankId,
      dealerId: dto.dealerId !== undefined ? dto.dealerId : existing.dealerId,
      status: dto.status !== undefined ? dto.status : existing.status,
    };

    if (merged.status === CaseStatus.Draft) {
      if (!merged.customer.firstName || merged.customer.firstName.trim().length === 0) {
        throw new BadRequestException('First Name (or name) is required to save draft');
      }
      if (!merged.customer.contact || merged.customer.contact.trim().length === 0) {
        throw new BadRequestException('Contact number is required to save draft');
      }
      if (!merged.dealerId) {
        throw new BadRequestException('Dealer is required to save draft');
      }
    } else if (merged.status !== CaseStatus.Incomplete) {
      if (!merged.customer.firstName || merged.customer.firstName.trim().length === 0) {
        throw new BadRequestException('First Name is required');
      }
      if (!merged.customer.lastName || merged.customer.lastName.trim().length === 0) {
        throw new BadRequestException('Last Name is required');
      }
      if (!merged.customer.contact || merged.customer.contact.trim().length === 0) {
        throw new BadRequestException('Contact number is required');
      }
      if (!merged.customer.location || merged.customer.location.trim().length === 0) {
        throw new BadRequestException('Location is required');
      }
      if (!merged.product) {
        throw new BadRequestException('Product Type is required');
      }
      if (!merged.firm) {
        throw new BadRequestException('Firm is required');
      }
      if (!merged.loanAmount) {
        throw new BadRequestException('Loan Amount is required');
      }
      if (!merged.bankId) {
        throw new BadRequestException('Bank is required');
      }
      if (!merged.dealerId) {
        throw new BadRequestException('Dealer is required');
      }
    }

    // Re-denormalize if references changed
    const update: Record<string, any> = { ...dto };
    if (dto.bankId && dto.bankId !== String(existing.bankId)) {
      try { const b = await this.banks.findById(dto.bankId); update.bankName = b.name; } catch {}
    }
    if (dto.dealerId && dto.dealerId !== String(existing.dealerId)) {
      try { const d = await this.dealers.findById(dto.dealerId); update.dealerName = d.name; } catch {}
    }

    const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    await this.activities.log({
      caseId: id, type: ActivityType.Remark,
      description: `Case updated`, actor,
    });

    this.notifyCaseUpdated({
      caseCode: existing.caseCode,
      customerName: [merged.customer?.firstName, merged.customer?.lastName].filter(Boolean).join(' '),
      coordinatorId: existing.coordinatorId,
      assignedTo: existing.assignedTo,
      changeDescription: 'Case details updated',
      actor,
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateCaseStatusDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, existing);

    const oldStatus = existing.status;
    const update: Record<string, any> = { status: dto.status };
    if (dto.status === CaseStatus.Disbursed && dto.disbursementDate) {
      update.disbursementDate = new Date(dto.disbursementDate);
    }

    const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    await this.activities.log({
      caseId: id, type: ActivityType.StatusChange,
      description: `Status changed from ${oldStatus} to ${dto.status}`,
      note: dto.note, oldStatus, newStatus: dto.status, actor,
    });

    this.notifyStatusChanged({
      caseCode: existing.caseCode,
      customerName: [existing.customer?.firstName, existing.customer?.lastName].filter(Boolean).join(' '),
      coordinatorId: existing.coordinatorId,
      assignedTo: existing.assignedTo,
      oldStatus, newStatus: dto.status, note: dto.note, actor,
    });

    // Keep customer's latestCaseStatus in sync (non-blocking)
    if (existing.customer?.contact) {
      this.customersService.syncCaseStatus(
        existing.customer.contact,
        existing.caseCode,
        dto.status,
      ).catch(() => {});
    }

    return updated;
  }

  async assign(id: string, dto: AssignCaseDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, existing);

    const newAssignee = new Types.ObjectId(dto.userId);
    const { coordinatorId, coordinatorName } = await this.resolveCoordinator(newAssignee);

    const update: Record<string, any> = { assignedTo: newAssignee, assignedToName: dto.userName };
    if (coordinatorId) {
      update.coordinatorId = coordinatorId;
      update.coordinatorName = coordinatorName;
    } else {
      update.$unset = { coordinatorId: '', coordinatorName: '' };
    }

    const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();

    await this.activities.log({
      caseId: id, type: ActivityType.Assigned,
      description: `Case assigned to ${dto.userName}`, actor,
    });

    this.notifyCaseUpdated({
      caseCode: existing.caseCode,
      customerName: [existing.customer?.firstName, existing.customer?.lastName].filter(Boolean).join(' '),
      coordinatorId,
      assignedTo: newAssignee,
      changeDescription: `Case reassigned to ${dto.userName}`,
      actor,
    });

    return updated;
  }

  async requestDocs(id: string, dto: RequestDocsDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, existing);

    const oldStatus = existing.status;
    const docRequest = {
      _id: new Types.ObjectId(),
      docTypes: dto.docTypes,
      remarks: dto.remarks,
      requestedBy: new Types.ObjectId(actor.id),
      requestedByName: `${actor.firstName} ${actor.lastName}`.trim(),
      requestedAt: new Date(),
      isResolved: false,
    };

    const updated = await this.model.findByIdAndUpdate(
      id,
      {
        status: CaseStatus.Incomplete,
        $push: { docRequests: docRequest },
      },
      { new: true },
    ).lean();

    await this.activities.log({
      caseId: id, type: ActivityType.DocumentRequested,
      description: `Document deficiency raised: ${dto.docTypes.join(', ')}`,
      note: dto.remarks, oldStatus, newStatus: CaseStatus.Incomplete, actor,
    });

    if (oldStatus !== CaseStatus.Incomplete) {
      this.notifyStatusChanged({
        caseCode: existing.caseCode,
        customerName: [existing.customer?.firstName, existing.customer?.lastName].filter(Boolean).join(' '),
        coordinatorId: existing.coordinatorId,
        assignedTo: existing.assignedTo,
        oldStatus, newStatus: CaseStatus.Incomplete, note: dto.remarks, actor,
      });
    }

    return updated;
  }

  async uploadDoc(id: string, dto: UploadDocDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, existing);

    const doc = {
      _id: new Types.ObjectId(),
      docType: dto.docType,
      fileName: dto.fileName,
      url: dto.url ?? '',
      remarks: dto.remarks,
      uploadedBy: new Types.ObjectId(actor.id),
      uploadedByName: `${actor.firstName} ${actor.lastName}`.trim(),
      uploadedAt: new Date(),
    };

    const updated = await this.model.findByIdAndUpdate(
      id,
      { $push: { documents: doc } },
      { new: true },
    ).lean();

    await this.activities.log({
      caseId: id, type: ActivityType.DocumentUploaded,
      description: `Document uploaded: ${dto.docType} — ${dto.fileName}`, actor,
    });
    return updated;
  }

  async editDoc(id: string, docId: string, dto: EditDocDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, existing);

    const updateFields: any = {};
    if (dto.fileName) updateFields['documents.$[doc].fileName'] = dto.fileName;
    if (dto.remarks !== undefined) updateFields['documents.$[doc].remarks'] = dto.remarks;

    const updated = await this.model.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { arrayFilters: [{ 'doc._id': new Types.ObjectId(docId) }], new: true },
    ).lean();

    await this.activities.log({
      caseId: id, type: ActivityType.Remark,
      description: `Document updated`, actor,
    });
    return updated;
  }

  async deleteDoc(id: string, docId: string, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, existing);

    const doc = existing.documents.find(d => String((d as any)._id) === docId);

    const updated = await this.model.findByIdAndUpdate(
      id,
      { $pull: { documents: { _id: new Types.ObjectId(docId) } } },
      { new: true },
    ).lean();

    await this.activities.log({
      caseId: id, type: ActivityType.Remark,
      description: `Document deleted: ${doc?.fileName || 'Unknown'}`, actor,
    });
    return updated;
  }

  async resolveDocRequest(caseId: string, requestId: string, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: caseId, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, existing);

    const updated = await this.model.findByIdAndUpdate(
      caseId,
      {
        $set: {
          'docRequests.$[req].isResolved': true,
          'docRequests.$[req].resolvedAt': new Date(),
        },
      },
      { arrayFilters: [{ 'req._id': new Types.ObjectId(requestId) }], new: true },
    ).lean();

    await this.activities.log({
      caseId, type: ActivityType.Remark,
      description: `Document request marked as resolved`, actor,
    });
    return updated;
  }

  async submitForVerification(id: string, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, existing);

    if (existing.status !== CaseStatus.Incomplete) {
      throw new BadRequestException('Case must be in Incomplete status to submit for verification');
    }

    const oldStatus = existing.status;
    const updated = await this.model.findByIdAndUpdate(
      id,
      { status: CaseStatus.Pending },
      { new: true },
    ).lean();

    await this.activities.log({
      caseId: id, type: ActivityType.Resubmitted,
      description: `Documents resubmitted for verification`,
      oldStatus, newStatus: CaseStatus.Pending, actor,
    });

    this.notifyStatusChanged({
      caseCode: existing.caseCode,
      customerName: [existing.customer?.firstName, existing.customer?.lastName].filter(Boolean).join(' '),
      coordinatorId: existing.coordinatorId,
      assignedTo: existing.assignedTo,
      oldStatus, newStatus: CaseStatus.Pending, actor,
    });

    return updated;
  }

  async updatePipelineStage(id: string, stage: string, dto: UpdatePipelineStageDto, actor: AuthUser) {
    const doc = await this.model.findOne({ _id: id, isActive: true });
    if (!doc) throw new NotFoundException('Case not found');
    await this.assertCanAccessCase(actor, doc);

    const stagesForCase = pipelineStagesFor(doc.product);
    const validStage = stagesForCase.includes(stage);
    if (!validStage) throw new BadRequestException(`Unknown pipeline stage: ${stage}`);

    // Ensure pipeline array is initialised (for legacy cases created before this feature)
    if (!doc.pipeline || doc.pipeline.length === 0) {
      doc.pipeline = stagesForCase.map((s) => ({ stage: s, status: 'Pending' }) as any);
    }

    const item = doc.pipeline.find((p: any) => p.stage === stage);
    if (!item) throw new NotFoundException(`Stage not found: ${stage}`);

    (item as any).status = dto.status;
    if (dto.status === 'Done') {
      (item as any).doneAt = new Date();
      (item as any).doneByName = `${actor.firstName} ${actor.lastName}`.trim();
    } else {
      (item as any).doneAt = undefined;
      (item as any).doneByName = undefined;
    }
    if (dto.remarks !== undefined) (item as any).remarks = dto.remarks;

    doc.markModified('pipeline');
    await doc.save();

    // Automation: when all applicable stages are Done, advance status to Disbursed
    const allDone = doc.pipeline.every((p: any) => p.status === 'Done' || p.status === 'NA');
    if (allDone && doc.status !== CaseStatus.Disbursed) {
      const before = doc.status;
      doc.status = CaseStatus.Disbursed;
      doc.disbursementDate = new Date();
      await doc.save();
      await this.activities.log({
        caseId: id, type: ActivityType.StatusChange,
        description: `Auto-advanced to Disbursed — all pipeline stages complete`,
        oldStatus: before, newStatus: CaseStatus.Disbursed, actor,
      });

      this.notifyStatusChanged({
        caseCode: doc.caseCode,
        customerName: [doc.customer?.firstName, doc.customer?.lastName].filter(Boolean).join(' '),
        coordinatorId: doc.coordinatorId,
        assignedTo: doc.assignedTo,
        oldStatus: before, newStatus: CaseStatus.Disbursed,
        note: 'Auto-advanced — all pipeline stages complete', actor,
      });

      if (doc.assignedTo) {
        await this.notifications.notify({
          userId: String(doc.assignedTo),
          type: 'pipeline_complete',
          title: `Pipeline Complete — ${doc.caseCode}`,
          message: `All stages done for ${doc.customer?.firstName ?? ''} ${doc.customer?.lastName ?? ''}. Case auto-moved to Disbursed.`,
          caseId: id, caseCode: doc.caseCode,
        });
      }
    }

    await this.activities.log({
      caseId: id, type: ActivityType.Remark,
      description: `Pipeline stage "${stage}" marked ${dto.status}`,
      note: dto.remarks, actor,
    });

    return this.findById(id);
  }

  async delete(id: string, actor: AuthUser) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Case not found');
    doc.isActive = false;
    await doc.save();
    return { id };
  }

  /**
   * `from`/`to` (YYYY-MM-DD) and bankId/product/firm are all optional. With no
   * range given, behaves exactly as before (all-time totals + this-calendar-month
   * disbursed figures) — existing callers see no change. With a range given,
   * every figure scopes to it (leads/status/bank/product by createdAt, disbursed
   * figures by disbursementDate).
   */
  async stats(params: { from?: string; to?: string; bankId?: string; product?: string; firm?: string } = {}) {
    const { from, to, bankId, product, firm } = params;

    const baseMatch: Record<string, any> = { isActive: true };
    if (bankId) baseMatch.bankId = new Types.ObjectId(bankId);
    if (product) baseMatch.product = product;
    if (firm) baseMatch.firm = firm;

    const hasRange = !!(from || to);
    const rangeStart = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rangeEnd = to ? new Date(new Date(to).getTime() + 86_400_000 - 1) : new Date();

    const leadsMatch = { ...baseMatch, ...(hasRange ? { createdAt: { $gte: rangeStart, $lte: rangeEnd } } : {}) };
    const disbursedMatch = { ...baseMatch, status: CaseStatus.Disbursed, disbursementDate: { $gte: rangeStart, $lte: rangeEnd } };
    const activeMatch = { ...baseMatch, status: { $nin: [CaseStatus.Disbursed, CaseStatus.Rejected, CaseStatus.Cancelled] } };

    const [totalLeads, disbursedMTD, activeCases, statusBreakdown] = await Promise.all([
      this.model.countDocuments(leadsMatch),
      this.model.countDocuments(disbursedMatch),
      this.model.countDocuments(activeMatch),
      this.model.aggregate([
        { $match: leadsMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const disbursedMTDAmount = await this.model.aggregate([
      { $match: disbursedMatch },
      { $group: { _id: null, total: { $sum: '$loanAmount' } } },
    ]);

    const bankWise = await this.model.aggregate([
      { $match: { ...leadsMatch, bankName: { $exists: true, $ne: '' } } },
      { $group: { _id: '$bankName', count: { $sum: 1 }, volume: { $sum: '$loanAmount' } } },
      { $sort: { volume: -1 } },
      { $limit: 8 },
    ]);

    const productMix = await this.model.aggregate([
      { $match: leadsMatch },
      { $group: { _id: '$product', count: { $sum: 1 } } },
    ]);

    return {
      totalLeads,
      disbursedMTD,
      disbursedMTDAmount: disbursedMTDAmount[0]?.total ?? 0,
      activeCases,
      statusBreakdown: Object.fromEntries(statusBreakdown.map((s) => [s._id, s.count])),
      bankWise,
      productMix,
    };
  }

  /**
   * Time-bucketed trend: leads created + cases disbursed (count & ₹ volume) per
   * bucket, gap-filled so the chart has a continuous axis with no missing days.
   * Defaults to the trailing 30 days when no range is given.
   */
  async trend(params: {
    from?: string; to?: string; groupBy?: 'day' | 'month';
    bankId?: string; product?: string; firm?: string; status?: string;
  }) {
    const { from, to, groupBy = 'day', bankId, product, firm, status } = params;

    const toDate = to ? new Date(new Date(to).getTime() + 86_400_000 - 1) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 29 * 86_400_000);

    if (groupBy === 'day' && (toDate.getTime() - fromDate.getTime()) / 86_400_000 > 366) {
      throw new BadRequestException('Date range too large for daily grouping — use monthly grouping or a shorter range');
    }

    const baseMatch: Record<string, any> = { isActive: true };
    if (bankId) baseMatch.bankId = new Types.ObjectId(bankId);
    if (product) baseMatch.product = product;
    if (firm) baseMatch.firm = firm;
    if (status && status !== 'All') baseMatch.status = status;

    const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const [leadsAgg, disbursedAgg] = await Promise.all([
      this.model.aggregate([
        { $match: { ...baseMatch, createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      this.model.aggregate([
        { $match: { ...baseMatch, status: CaseStatus.Disbursed, disbursementDate: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$disbursementDate' } }, count: { $sum: 1 }, volume: { $sum: '$loanAmount' } } },
      ]),
    ]);

    const buckets: string[] = [];
    if (groupBy === 'month') {
      const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
      while (cur <= end) {
        buckets.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
      while (cur <= end) {
        buckets.push(
          `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
        );
        cur.setDate(cur.getDate() + 1);
      }
    }

    const leadsMap = new Map(leadsAgg.map((r) => [r._id as string, r.count as number]));
    const disbursedMap = new Map(disbursedAgg.map((r) => [r._id as string, { count: r.count as number, volume: r.volume as number }]));

    return buckets.map((key) => ({
      date: key,
      leads: leadsMap.get(key) ?? 0,
      disbursed: disbursedMap.get(key)?.count ?? 0,
      volume: disbursedMap.get(key)?.volume ?? 0,
    }));
  }
}
