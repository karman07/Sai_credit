import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InsuranceMIS } from './schemas/insurance-mis.schema';
import { CreateInsuranceMISDto, UpdateInsuranceMISDto } from './insurance-mis.dto';
import { AuthUser } from '../common/types';

@Injectable()
export class InsuranceMISService {
  constructor(@InjectModel(InsuranceMIS.name) private readonly model: Model<InsuranceMIS>) {}

  async list(expiryFilter?: string) {
    const filter: Record<string, any> = { isActive: true };
    if (expiryFilter) {
      const now = new Date();
      const days = parseInt(expiryFilter, 10);
      const cutoff = new Date(now.getTime() + days * 86400000);
      filter.endDate = { $lte: cutoff };
    }
    return this.model.find(filter).sort({ endDate: 1 }).lean();
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Insurance record not found');
    return doc;
  }

  async create(dto: CreateInsuranceMISDto, actor: AuthUser) {
    return this.model.create({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      createdBy: actor.id,
    });
  }

  async update(id: string, dto: UpdateInsuranceMISDto) {
    const update: Record<string, any> = { ...dto };
    if (dto.startDate) update.startDate = new Date(dto.startDate);
    if (dto.endDate) update.endDate = new Date(dto.endDate);
    const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('Insurance record not found');
    return doc;
  }

  async delete(id: string) {
    await this.model.findByIdAndUpdate(id, { isActive: false });
    return { id };
  }
}
