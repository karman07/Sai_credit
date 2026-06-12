import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Dealer } from './schemas/dealer.schema';
import { CreateDealerDto, UpdateDealerDto } from './dealers.dto';
import { AuthUser } from '../common/types';

@Injectable()
export class DealersService {
  constructor(@InjectModel(Dealer.name) private readonly model: Model<Dealer>) {}

  async list(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };
    return this.model.find(filter).sort({ name: 1 }).lean();
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Dealer not found');
    return doc;
  }

  async create(dto: CreateDealerDto, actor: AuthUser) {
    return this.model.create({ ...dto, createdBy: actor.id });
  }

  async update(id: string, dto: UpdateDealerDto) {
    const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('Dealer not found');
    return doc;
  }

  async toggleStatus(id: string) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Dealer not found');
    doc.isActive = !doc.isActive;
    await doc.save();
    return { id, isActive: doc.isActive };
  }

  async delete(id: string) {
    await this.model.findByIdAndDelete(id);
    return { id };
  }
}
