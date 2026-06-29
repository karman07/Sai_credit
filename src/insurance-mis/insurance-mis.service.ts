import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InsuranceMIS } from './schemas/insurance-mis.schema';
import { CreateInsuranceMISDto, UpdateInsuranceMISDto } from './insurance-mis.dto';
import { AuthUser } from '../common/types';

@Injectable()
export class InsuranceMISService {
  constructor(@InjectModel(InsuranceMIS.name) private readonly model: Model<InsuranceMIS>) {}

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

  async update(id: string, dto: UpdateInsuranceMISDto) {
    const update: Record<string, any> = { ...dto };
    if (dto.startDate) update.startDate = new Date(dto.startDate);
    if (dto.endDate) update.endDate = new Date(dto.endDate);
    if (dto.reminderDate) update.reminderDate = new Date(dto.reminderDate);
    if (dto.endorsement) {
      update.endorsement = {
        date: dto.endorsement.date ? new Date(dto.endorsement.date) : undefined,
        note: dto.endorsement.note,
      };
    }
    const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('Insurance record not found');
    return doc;
  }

  async delete(id: string) {
    await this.model.findByIdAndUpdate(id, { isActive: false });
    return { id };
  }
}
