import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InsuranceLead, InsuranceLeadStatus } from './schemas/insurance-lead.schema';
import { InsuranceMIS } from '../insurance-mis/schemas/insurance-mis.schema';
import { CounterService } from '../common/counter/counter.service';
import { AuthUser } from '../common/types';
import {
  CreateInsuranceLeadDto, UpdateInsuranceLeadDto, ConvertLeadDto,
} from './insurance-leads.dto';
import { isSalesRole, UserRole } from '../common/enums';

@Injectable()
export class InsuranceLeadsService {
  constructor(
    @InjectModel(InsuranceLead.name) private readonly model: Model<InsuranceLead>,
    @InjectModel(InsuranceMIS.name)  private readonly misModel: Model<InsuranceMIS>,
    private readonly counter: CounterService,
  ) {}

  async list(actor: AuthUser, query: {
    status?: string; source?: string; assignedTo?: string;
    search?: string; page?: number; limit?: number; mine?: boolean;
  }) {
    const isAdmin = !isSalesRole(actor.role as UserRole);
    const filter: Record<string, any> = { isActive: true };

    if (!isAdmin || query.mine) {
      filter.assignedTo = new Types.ObjectId(actor.id);
    } else if (query.assignedTo) {
      filter.assignedTo = new Types.ObjectId(query.assignedTo);
    }

    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.search) {
      const re = new RegExp(query.search, 'i');
      filter.$or = [
        { leadCode: re }, { firstName: re }, { lastName: re },
        { contact: re }, { vehicleModel: re }, { regNumber: re },
      ];
    }

    const page  = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 30);
    const skip  = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('assignedTo', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit).lean(),
      this.model.countDocuments(filter),
    ]);
    return { leads, total, page, limit };
  }

  async findById(id: string) {
    const doc = await this.model.findById(id)
      .populate('assignedTo', 'firstName lastName role')
      .lean();
    if (!doc) throw new NotFoundException('Insurance lead not found');
    return doc;
  }

  async create(dto: CreateInsuranceLeadDto, actor: AuthUser) {
    const leadCode = await this.counter.code('IL', 'insurance-lead');
    const assignedTo = dto.assignedTo
      ? new Types.ObjectId(dto.assignedTo)
      : new Types.ObjectId(actor.id);

    return this.model.create({
      ...dto,
      leadCode,
      assignedTo,
      policyExpiryDate: dto.policyExpiryDate ? new Date(dto.policyExpiryDate) : undefined,
      followUpDate:     dto.followUpDate     ? new Date(dto.followUpDate)     : undefined,
      createdBy:     new Types.ObjectId(actor.id),
      createdByName: `${actor.firstName} ${actor.lastName}`,
    });
  }

  async update(id: string, dto: UpdateInsuranceLeadDto) {
    const update: Record<string, any> = { ...dto };
    if (dto.policyExpiryDate) update.policyExpiryDate = new Date(dto.policyExpiryDate);
    if (dto.followUpDate)     update.followUpDate     = new Date(dto.followUpDate);
    if (dto.assignedTo)       update.assignedTo       = new Types.ObjectId(dto.assignedTo);

    // Auto-stamp convertedAt the first time status is set to converted
    if (dto.status === InsuranceLeadStatus.Converted) {
      await this.model.updateOne(
        { _id: id, convertedAt: { $exists: false } },
        { $set: { convertedAt: new Date() } },
      );
    }

    const doc = await this.model.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) throw new NotFoundException('Insurance lead not found');
    return doc;
  }

  async convertToMIS(id: string, dto: ConvertLeadDto, actor: AuthUser) {
    const lead = await this.model.findById(id);
    if (!lead) throw new NotFoundException('Insurance lead not found');

    const mis = await this.misModel.create({
      caseId:        dto.caseId     ? new Types.ObjectId(dto.caseId)     : undefined,
      policyId:      dto.policyId   ? new Types.ObjectId(dto.policyId)   : undefined,
      policyName:    dto.policyName,
      customerName:  `${lead.firstName} ${lead.lastName}`,
      vehicleModel:  lead.vehicleModel,
      vehicleType:   lead.vehicleType,
      coverageType:  dto.coverageType,
      premiumAmount: dto.premiumAmount,
      insurer:       dto.insurer,
      insuredName:   dto.insuredName ?? `${lead.firstName} ${lead.lastName}`,
      agentName:     dto.agentName,
      ownerType:     dto.ownerType ?? 'Sai Credit',
      holdAmount:    dto.holdAmount ?? 0,
      startDate:     new Date(dto.startDate),
      endDate:       new Date(dto.endDate),
      reminderDate:  dto.reminderDate ? new Date(dto.reminderDate) : undefined,
      createdBy:     actor.id,
      createdByName: `${actor.firstName} ${actor.lastName}`,
    });

    lead.status          = InsuranceLeadStatus.Converted;
    lead.convertedMisId  = mis._id as Types.ObjectId;
    if (!lead.convertedAt) lead.set('convertedAt', new Date());
    await lead.save();

    return { lead, mis };
  }

  async delete(id: string) {
    const doc = await this.model.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!doc) throw new NotFoundException('Insurance lead not found');
    return { id };
  }

  async stats(actor: AuthUser) {
    const isAdmin = !isSalesRole(actor.role as UserRole);
    const base: Record<string, any> = { isActive: true };
    if (!isAdmin) base.assignedTo = new Types.ObjectId(actor.id);

    const rows = await this.model.aggregate([
      { $match: base },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const map: Record<string, number> = {};
    for (const r of rows) map[r._id] = r.count;
    return {
      total:      Object.values(map).reduce((s, v) => s + v, 0),
      new:        map['new']        ?? 0,
      contacted:  map['contacted']  ?? 0,
      interested: map['interested'] ?? 0,
      converted:  map['converted']  ?? 0,
      lost:       map['lost']       ?? 0,
    };
  }
}
