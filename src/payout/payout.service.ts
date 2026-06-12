import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PayoutRecord } from './schemas/payout.schema';
import { CreatePayoutDto, UpdatePayoutDto } from './payout.dto';
import { AuthUser } from '../common/types';

@Injectable()
export class PayoutService {
  constructor(@InjectModel(PayoutRecord.name) private readonly model: Model<PayoutRecord>) {}

  async list(month?: string, bankId?: string) {
    const filter: Record<string, any> = {};
    if (month) filter.businessMonth = month;
    if (bankId) filter.bankId = bankId;
    return this.model.find(filter).sort({ businessMonth: -1, bankName: 1 }).lean();
  }

  async months() {
    const months = await this.model.distinct('businessMonth');
    return months.sort().reverse();
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Payout record not found');
    return doc;
  }

  async create(dto: CreatePayoutDto, actor: AuthUser) {
    return this.model.create({ ...dto, createdBy: actor.id });
  }

  async update(id: string, dto: UpdatePayoutDto) {
    const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('Payout record not found');
    return doc;
  }

  async delete(id: string) {
    await this.model.findByIdAndDelete(id);
    return { id };
  }
}
