import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RTORecord } from './schemas/rto-tracker.schema';
import {
  CreateRTODto, UpdateRTODto, UpdateStageDto, RequestRtoDocsDto, RespondToRequestDto,
} from './rto-tracker.dto';
import { AuthUser } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { ADMIN_PORTAL_ROLES, CaseStatus, MasterType, RTOStatus, UserRole, isSalesRole } from '../common/enums';
import { LoanCase, VEHICLE_PRODUCTS } from '../cases/schemas/case.schema';
import { Master } from '../masters/schemas/master.schema';
import { User } from '../users/schemas/user.schema';
import { hasPermission, isRtoCoordinator } from '../rbac/permissions';

@Injectable()
export class RTOTrackerService {
  constructor(
    @InjectModel(RTORecord.name) private readonly model: Model<RTORecord>,
    @InjectModel(LoanCase.name) private readonly caseModel: Model<LoanCase>,
    @InjectModel(Master.name) private readonly masterModel: Model<Master>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Access ─────────────────────────────────────────────────────────

  /** Who may work an RTO file (change stages, request docs, edit details). */
  private canWork(actor: AuthUser) {
    return hasPermission(actor, 'rto.update');
  }

  /** Read scope: RTO coordinators/admins see everything; sales see their own files; a team coordinator their reps'. */
  private scopeFilter(actor: AuthUser): Record<string, any> {
    if (isRtoCoordinator(actor) || ADMIN_PORTAL_ROLES.includes(actor.role)) return {};
    const uid = new Types.ObjectId(actor.id);
    if (actor.role === UserRole.Coordinator) return { salesCoordinatorId: uid };
    if (isSalesRole(actor.role)) return { salesRepId: uid };
    return { _id: null }; // nothing
  }

  private async getScoped(id: string, actor: AuthUser) {
    const doc = await this.model.findOne({ _id: id, ...this.scopeFilter(actor) });
    if (!doc) throw new NotFoundException('RTO record not found');
    return doc;
  }

  // ── Reads ──────────────────────────────────────────────────────────

  async list(actor: AuthUser, caseId?: string) {
    const filter: Record<string, any> = { ...this.scopeFilter(actor) };
    if (caseId) filter.caseId = new Types.ObjectId(caseId);
    return this.model.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findById(id: string, actor: AuthUser) {
    const doc = await this.getScoped(id, actor);
    return doc.toObject();
  }

  async findByCaseId(caseId: string) {
    return this.model.findOne({ caseId: new Types.ObjectId(caseId) }).lean();
  }

  /**
   * Returns the RTO record for a case. RTO workers get one created on first
   * open (stages seeded from the Data Catalog) and any stages added to the
   * catalog since are appended; read-only users get null if none exists yet.
   */
  async getByCase(caseId: string, actor: AuthUser) {
    const existing = await this.model.findOne({ caseId: new Types.ObjectId(caseId), ...this.scopeFilter(actor) });
    if (!this.canWork(actor)) return existing ? existing.toObject() : null;
    if (existing) return (await this.syncStages(existing, actor)).toObject();
    return (await this.initialise(caseId, actor)).toObject();
  }

  // ── Writes ─────────────────────────────────────────────────────────

  private async catalogStages() {
    const masters = await this.masterModel
      .find({ type: MasterType.RtoStage, isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    return masters.map((m, i) => ({
      stageId: String(m._id), name: m.name, order: i, status: 'Pending', comments: [] as any[],
    }));
  }

  private async initialise(caseId: string, actor: AuthUser) {
    const loanCase = await this.caseModel.findOne({ _id: caseId, isActive: true }).lean();
    if (!loanCase) throw new NotFoundException('Case not found');
    if (loanCase.status !== CaseStatus.Disbursed) {
      throw new BadRequestException('RTO work starts once the case is Disbursed');
    }
    if (!loanCase.product || !VEHICLE_PRODUCTS.includes(loanCase.product)) {
      throw new BadRequestException('RTO applies to vehicle loans only');
    }
    const customerName = [loanCase.customer?.firstName, loanCase.customer?.lastName].filter(Boolean).join(' ');
    const owner = isRtoCoordinator(actor)
      ? { rtoOwnerId: new Types.ObjectId(actor.id), rtoOwnerName: `${actor.firstName} ${actor.lastName}`.trim() }
      : {};

    // Upsert so two people opening the same file at once can't create duplicates.
    const doc = await this.model.findOneAndUpdate(
      { caseId: loanCase._id },
      {
        $setOnInsert: {
          caseCode: loanCase.caseCode,
          customerName,
          product: loanCase.product,
          status: RTOStatus.Pending,
          stages: await this.catalogStages(),
          salesRepId: loanCase.assignedTo,
          salesRepName: loanCase.assignedToName,
          salesCoordinatorId: loanCase.coordinatorId,
          createdBy: new Types.ObjectId(actor.id),
          ...owner,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return doc!;
  }

  private async syncStages(doc: any, actor: AuthUser) {
    const catalog = await this.catalogStages();
    const have = new Set(doc.stages.map((s: any) => s.stageId));
    const missing = catalog.filter((s) => !have.has(s.stageId));
    if (!missing.length) return doc;
    // A file that was already completed re-opens when the admin adds a new stage.
    const reopen = doc.status === RTOStatus.Completed ? { status: RTOStatus.UnderVerification, $unset: { completedAt: '' } } : {};
    const { $unset, ...set } = reopen as any;
    const updated = await this.model.findByIdAndUpdate(
      doc._id,
      { $push: { stages: { $each: missing } }, ...(Object.keys(set).length ? { $set: set, $unset } : {}) },
      { new: true },
    );
    return updated ?? doc;
  }

  async create(dto: CreateRTODto, actor: AuthUser) {
    if (dto.caseId) {
      const doc = await this.initialise(dto.caseId, actor);
      return this.update(String(doc._id), dto, actor);
    }
    return this.model.create({
      ...dto,
      approvalDate: dto.approvalDate ? new Date(dto.approvalDate) : undefined,
      createdBy: actor.id,
    });
  }

  async update(id: string, dto: UpdateRTODto, actor: AuthUser) {
    const update: Record<string, any> = { ...dto };
    delete update.caseId;
    if (dto.approvalDate) update.approvalDate = new Date(dto.approvalDate);

    const doc = await this.model.findByIdAndUpdate(id, update, { new: true });
    if (!doc) throw new NotFoundException('RTO record not found');
    await this.claim(doc, actor);
    return doc.toObject();
  }

  async upsertByCaseId(caseId: string, dto: UpdateRTODto, actor: AuthUser) {
    const doc = await this.initialise(caseId, actor);
    return this.update(String(doc._id), dto, actor);
  }

  /** The first RTO coordinator to work a file becomes its owner. */
  private async claim(doc: any, actor: AuthUser) {
    if (!isRtoCoordinator(actor) || doc.rtoOwnerId) return;
    doc.rtoOwnerId = new Types.ObjectId(actor.id);
    doc.rtoOwnerName = `${actor.firstName} ${actor.lastName}`.trim();
    await doc.save();
  }

  async updateStage(id: string, stageId: string, dto: UpdateStageDto, actor: AuthUser) {
    const doc = await this.getScoped(id, actor);
    const stage = doc.stages.find((s) => s.stageId === stageId);
    if (!stage) throw new NotFoundException('Stage not found on this RTO record');
    const name = `${actor.firstName} ${actor.lastName}`.trim();
    const now = new Date();

    if (dto.status && dto.status !== stage.status) {
      stage.status = dto.status;
      stage.doneAt = dto.status === 'Done' ? now : undefined;
    }
    if (dto.comment) {
      stage.comments.push({ text: dto.comment, authorId: new Types.ObjectId(actor.id), authorName: name, at: now } as any);
    }
    stage.updatedAt = now;
    stage.updatedByName = name;
    doc.markModified('stages');

    await this.claim(doc, actor);
    await this.refreshStatus(doc);
    return doc.toObject();
  }

  /** Derives the overall status from the stages and fires the one-off completion notification. */
  private async refreshStatus(doc: any) {
    const active = doc.stages.filter((s: any) => s.status !== 'NA');
    const allDone = active.length > 0 && active.every((s: any) => s.status === 'Done');
    const started = doc.stages.some((s: any) => s.status === 'In Progress' || s.status === 'Done');
    const justCompleted = allDone && !doc.completedAt;

    if (allDone) {
      doc.status = RTOStatus.Completed;
      doc.completedAt ??= new Date();
    } else {
      doc.completedAt = undefined;
      if (doc.status === RTOStatus.Completed) doc.status = RTOStatus.UnderVerification;
      else if (started && doc.status === RTOStatus.Pending) doc.status = RTOStatus.UnderVerification;
    }
    await doc.save();
    if (justCompleted) await this.notifyCompleted(doc);
  }

  /** Tells every admin (and the sales rep) the RTO for this case is fully done. */
  private async notifyCompleted(doc: any) {
    const admins = await this.userModel.find({ role: { $in: ADMIN_PORTAL_ROLES }, isActive: true }, '_id').lean();
    const ids = new Set(admins.map((u) => String(u._id)));
    if (doc.salesRepId) ids.add(String(doc.salesRepId));
    await this.notifications.notifyMany([...ids], {
      type: 'rto_complete',
      title: `RTO Completed — ${doc.caseCode ?? 'Case'}`,
      message: `${doc.rtoOwnerName ?? 'The RTO team'} completed all RTO stages for ${doc.customerName ?? doc.caseCode}.`,
      caseId: doc.caseId ? String(doc.caseId) : undefined,
      caseCode: doc.caseCode,
    });
  }

  // ── Document requests to the sales team ────────────────────────────

  async requestDocs(id: string, dto: RequestRtoDocsDto, actor: AuthUser) {
    const doc = await this.getScoped(id, actor);
    doc.docRequests.push({
      docTypes: dto.docTypes,
      remarks: dto.remarks,
      stageName: dto.stageName,
      requestedBy: new Types.ObjectId(actor.id),
      requestedByName: `${actor.firstName} ${actor.lastName}`.trim(),
      requestedAt: new Date(),
      isResolved: false,
    } as any);
    if (doc.status !== RTOStatus.Completed) doc.status = RTOStatus.DocumentsPending;
    await this.claim(doc, actor);
    await doc.save();

    const recipients = [doc.salesRepId, doc.salesCoordinatorId].filter(Boolean).map(String);
    await this.notifications.notifyMany([...new Set(recipients)], {
      type: 'rto_doc_request',
      title: `RTO Documents Requested — ${doc.caseCode}`,
      message: `${actor.firstName} ${actor.lastName} needs: ${dto.docTypes.join(', ')}`,
      caseId: doc.caseId ? String(doc.caseId) : undefined,
      caseCode: doc.caseCode,
    });
    return doc.toObject();
  }

  /** Sales answers an open request (note + files); RTO coordinators are told. */
  async respond(id: string, reqId: string, dto: RespondToRequestDto, actor: AuthUser) {
    const doc = await this.getScoped(id, actor);
    const req = doc.docRequests.find((r: any) => String(r._id) === reqId);
    if (!req) throw new NotFoundException('Request not found');
    if (req.isResolved) throw new BadRequestException('This request is already resolved');
    const name = `${actor.firstName} ${actor.lastName}`.trim();
    req.response = { text: dto.text.trim(), attachments: dto.attachments, byName: name, at: new Date() } as any;
    doc.markModified('docRequests');
    await doc.save();
    await this.notifyRtoTeam(doc, {
      type: 'rto_doc_response',
      title: `Documents Shared — ${doc.caseCode}`,
      message: `${name} responded to your request for ${req.docTypes.join(', ')}`,
    });
    return doc.toObject();
  }

  async resolveRequest(id: string, reqId: string, actor: AuthUser) {
    const doc = await this.getScoped(id, actor);
    const req = doc.docRequests.find((r: any) => String(r._id) === reqId);
    if (!req) throw new NotFoundException('Request not found');
    req.isResolved = true;
    req.resolvedAt = new Date();
    req.resolvedByName = `${actor.firstName} ${actor.lastName}`.trim();
    doc.markModified('docRequests');
    const stillOpen = doc.docRequests.some((r: any) => !r.isResolved);
    if (!stillOpen && doc.status === RTOStatus.DocumentsPending) doc.status = RTOStatus.UnderVerification;
    await doc.save();
    return doc.toObject();
  }

  /** The file's RTO owner, or every RTO coordinator if it hasn't been claimed yet. */
  private async notifyRtoTeam(doc: any, n: { type: any; title: string; message: string }) {
    let ids: string[];
    if (doc.rtoOwnerId) ids = [String(doc.rtoOwnerId)];
    else {
      const team = await this.userModel.find({ role: UserRole.Coordinator, rtoAccess: true, isActive: true }, '_id').lean();
      ids = team.map((u) => String(u._id));
    }
    await this.notifications.notifyMany(ids, {
      ...n, caseId: doc.caseId ? String(doc.caseId) : undefined, caseCode: doc.caseCode,
    });
  }
}
