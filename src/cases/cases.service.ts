import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LoanCase, PIPELINE_STAGES } from './schemas/case.schema';
import {
  CreateCaseDto, UpdateCaseDto, UpdateCaseStatusDto,
  AssignCaseDto, RequestDocsDto, UploadDocDto, EditDocDto,
  UpdatePipelineStageDto,
} from './cases.dto';
import { ActivityType, CaseStatus, isSalesRole, PRODUCT_CODE_PREFIX, ProductType } from '../common/enums';
import { AuthUser } from '../common/types';
import { CounterService } from '../common/counter/counter.service';
import { ActivitiesService } from '../activities/activities.service';
import { BanksService } from '../banks/banks.service';
import { DealersService } from '../dealers/dealers.service';
import { CustomersService } from '../customers/customers.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CasesService {
  constructor(
    @InjectModel(LoanCase.name) private readonly model: Model<LoanCase>,
    private readonly counter: CounterService,
    private readonly activities: ActivitiesService,
    private readonly banks: BanksService,
    private readonly dealers: DealersService,
    private readonly customersService: CustomersService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(params: {
    page?: number; limit?: number; search?: string; status?: string;
    bankId?: string; dealerId?: string; product?: string;
    assignedTo?: string; userId?: string; scopeToUser?: boolean;
  }) {
    const { page = 1, limit = 25, search, status, bankId, dealerId, product, assignedTo, userId, scopeToUser } = params;
    const filter: Record<string, any> = { isActive: true };

    // Sales users see cases they created OR were assigned to
    if (scopeToUser && userId) {
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

    const total = await this.model.countDocuments(filter);
    const data = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    const doc = await this.model.findOne({ _id: id, isActive: true }).lean();
    if (!doc) throw new NotFoundException('Case not found');
    return doc;
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

    const prefix = dto.product ? (PRODUCT_CODE_PREFIX[dto.product as ProductType] ?? 'CASE') : 'CASE';
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

    const created = await this.model.create({
      ...dto, status, caseCode, bankName, dealerName,
      assignedTo, assignedToName,
      createdBy: actor.id, isActive: true,
      documents: [], docRequests: [],
    });

    await this.activities.log({
      caseId: created._id, type: ActivityType.Created,
      description: `Case ${caseCode} created` + (status === CaseStatus.Draft ? ' as Draft' : ''), actor,
    });

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

    const merged = {
      customer: { ...existing.customer, ...dto.customer },
      product: dto.product !== undefined ? dto.product : existing.product,
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
    return updated;
  }

  async updateStatus(id: string, dto: UpdateCaseStatusDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');

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

    const updated = await this.model.findByIdAndUpdate(
      id,
      { assignedTo: new Types.ObjectId(dto.userId), assignedToName: dto.userName },
      { new: true },
    ).lean();

    await this.activities.log({
      caseId: id, type: ActivityType.Assigned,
      description: `Case assigned to ${dto.userName}`, actor,
    });
    return updated;
  }

  async requestDocs(id: string, dto: RequestDocsDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');

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
    return updated;
  }

  async uploadDoc(id: string, dto: UploadDocDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');

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
    return updated;
  }

  async updatePipelineStage(id: string, stage: string, dto: UpdatePipelineStageDto, actor: AuthUser) {
    const doc = await this.model.findOne({ _id: id, isActive: true });
    if (!doc) throw new NotFoundException('Case not found');

    const validStage = (PIPELINE_STAGES as readonly string[]).includes(stage);
    if (!validStage) throw new BadRequestException(`Unknown pipeline stage: ${stage}`);

    // Ensure pipeline array is initialised (for legacy cases created before this feature)
    if (!doc.pipeline || doc.pipeline.length === 0) {
      doc.pipeline = PIPELINE_STAGES.map((s) => ({ stage: s, status: 'Pending' }) as any);
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

  async stats() {
    const [totalLeads, disbursedMTD, activeCases, statusBreakdown] = await Promise.all([
      this.model.countDocuments({ isActive: true }),
      this.model.countDocuments({
        isActive: true,
        status: CaseStatus.Disbursed,
        disbursementDate: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      }),
      this.model.countDocuments({ isActive: true, status: { $nin: [CaseStatus.Disbursed, CaseStatus.Rejected, CaseStatus.Cancelled] } }),
      this.model.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const disbursedMTDAmount = await this.model.aggregate([
      { $match: { isActive: true, status: CaseStatus.Disbursed, disbursementDate: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
      { $group: { _id: null, total: { $sum: '$loanAmount' } } },
    ]);

    const bankWise = await this.model.aggregate([
      { $match: { isActive: true, bankName: { $exists: true, $ne: '' } } },
      { $group: { _id: '$bankName', count: { $sum: 1 }, volume: { $sum: '$loanAmount' } } },
      { $sort: { volume: -1 } },
      { $limit: 8 },
    ]);

    const productMix = await this.model.aggregate([
      { $match: { isActive: true } },
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
}
