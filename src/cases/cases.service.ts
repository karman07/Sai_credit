import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LoanCase } from './schemas/case.schema';
import { CreateCaseDto, UpdateCaseDto, UpdateCaseStatusDto } from './cases.dto';
import { ActivityType, CaseStatus, PRODUCT_CODE_PREFIX, ProductType } from '../common/enums';
import { AuthUser } from '../common/types';
import { CounterService } from '../common/counter/counter.service';
import { ActivitiesService } from '../activities/activities.service';
import { BanksService } from '../banks/banks.service';
import { DealersService } from '../dealers/dealers.service';
import { CoordinatorsService } from '../coordinators/coordinators.service';

@Injectable()
export class CasesService {
  constructor(
    @InjectModel(LoanCase.name) private readonly model: Model<LoanCase>,
    private readonly counter: CounterService,
    private readonly activities: ActivitiesService,
    private readonly banks: BanksService,
    private readonly dealers: DealersService,
    private readonly coordinators: CoordinatorsService,
  ) {}

  async list(params: {
    page?: number; limit?: number; search?: string; status?: string;
    bankId?: string; dealerId?: string; coordinatorId?: string; product?: string;
    userId?: string; scopeToUser?: boolean;
  }) {
    const { page = 1, limit = 25, search, status, bankId, dealerId, coordinatorId, product, userId, scopeToUser } = params;
    const filter: Record<string, any> = { isActive: true };

    if (scopeToUser && userId) filter.createdBy = new Types.ObjectId(userId);
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ caseCode: re }, { 'customer.firstName': re }, { 'customer.lastName': re }, { 'customer.contact': re }];
    }
    if (status && status !== 'All') filter.status = status;
    if (bankId) filter.bankId = new Types.ObjectId(bankId);
    if (dealerId) filter.dealerId = new Types.ObjectId(dealerId);
    if (coordinatorId) filter.coordinatorId = new Types.ObjectId(coordinatorId);
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
    const prefix = PRODUCT_CODE_PREFIX[dto.product as ProductType] ?? 'CASE';
    const caseCode = await this.counter.code(prefix, `case:${prefix.toLowerCase()}`);

    // Denormalize names for fast display
    let bankName: string | undefined;
    let dealerName: string | undefined;
    let coordinatorName: string | undefined;

    if (dto.bankId) {
      try { const b = await this.banks.findById(dto.bankId); bankName = b.name; } catch {}
    }
    if (dto.dealerId) {
      try { const d = await this.dealers.findById(dto.dealerId); dealerName = d.name; } catch {}
    }
    if (dto.coordinatorId) {
      try { const c = await this.coordinators.findById(dto.coordinatorId); coordinatorName = c.name; } catch {}
    }

    const created = await this.model.create({
      ...dto, caseCode, bankName, dealerName, coordinatorName,
      createdBy: actor.id, isActive: true,
    });

    await this.activities.log({
      caseId: created._id, type: ActivityType.Created,
      description: `Case ${caseCode} created`, actor,
    });

    return created.toObject();
  }

  async update(id: string, dto: UpdateCaseDto, actor: AuthUser) {
    const existing = await this.model.findOne({ _id: id, isActive: true });
    if (!existing) throw new NotFoundException('Case not found');

    // Re-denormalize if references changed
    const update: Record<string, any> = { ...dto };
    if (dto.bankId && dto.bankId !== String(existing.bankId)) {
      try { const b = await this.banks.findById(dto.bankId); update.bankName = b.name; } catch {}
    }
    if (dto.dealerId && dto.dealerId !== String(existing.dealerId)) {
      try { const d = await this.dealers.findById(dto.dealerId); update.dealerName = d.name; } catch {}
    }
    if (dto.coordinatorId && dto.coordinatorId !== String(existing.coordinatorId)) {
      try { const c = await this.coordinators.findById(dto.coordinatorId); update.coordinatorName = c.name; } catch {}
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
    return updated;
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
