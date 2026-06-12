import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RTORecord } from './schemas/rto-tracker.schema';
import { CreateRTODto, UpdateRTODto } from './rto-tracker.dto';
import { AuthUser } from '../common/types';

@Injectable()
export class RTOTrackerService {
  constructor(@InjectModel(RTORecord.name) private readonly model: Model<RTORecord>) {}

  async list(caseId?: string) {
    const filter: Record<string, any> = {};
    if (caseId) filter.caseId = new Types.ObjectId(caseId);
    return this.model.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('RTO record not found');
    return doc;
  }

  async findByCaseId(caseId: string) {
    return this.model.findOne({ caseId: new Types.ObjectId(caseId) }).lean();
  }

  async create(dto: CreateRTODto, actor: AuthUser) {
    return this.model.create({ ...dto, createdBy: actor.id });
  }

  async update(id: string, dto: UpdateRTODto) {
    const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('RTO record not found');
    return doc;
  }

  async upsertByCaseId(caseId: string, dto: UpdateRTODto, actor: AuthUser) {
    const doc = await this.model.findOneAndUpdate(
      { caseId: new Types.ObjectId(caseId) },
      { ...dto, caseId: new Types.ObjectId(caseId), createdBy: actor.id },
      { new: true, upsert: true },
    ).lean();
    return doc;
  }
}
