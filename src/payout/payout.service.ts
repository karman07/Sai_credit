import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PayoutRecord } from './schemas/payout.schema';
import { Bank } from '../banks/schemas/bank.schema';
import { CreatePayoutDto, UpdatePayoutDto } from './payout.dto';
import { AuthUser } from '../common/types';

@Injectable()
export class PayoutService {
  constructor(
    @InjectModel(PayoutRecord.name) private readonly model: Model<PayoutRecord>,
    @InjectModel(Bank.name) private readonly bankModel: Model<Bank>,
  ) {}

  async list(month?: string, bankId?: string) {
    const filter: Record<string, any> = {};
    if (month) filter.businessMonth = month;
    if (bankId) filter.bankId = new Types.ObjectId(bankId);
    return this.model.find(filter).sort({ businessMonth: -1, bankName: 1 }).lean();
  }

  async months() {
    const months = await this.model.distinct('businessMonth');
    return (months as string[]).sort().reverse();
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Payout record not found');
    return doc;
  }

  async create(dto: CreatePayoutDto, actor: AuthUser) {
    const payload: Record<string, any> = { ...dto, createdBy: actor.id };

    // Auto-resolve bankName from bankId
    if (dto.bankId && !dto.bankName) {
      const bank = await this.bankModel.findById(dto.bankId).lean();
      if (bank) payload.bankName = bank.name;
    }

    // Auto-compute gstAmount from CGST + SGST if not explicitly provided
    if (!dto.gstAmount && (dto.cgstAmount || dto.sgstAmount)) {
      payload.gstAmount = (dto.cgstAmount ?? 0) + (dto.sgstAmount ?? 0);
    }

    // Auto-compute totalAmount if not provided
    if (!dto.totalAmount && dto.commission) {
      payload.totalAmount = (dto.commission ?? 0) + (payload.gstAmount ?? dto.gstAmount ?? 0);
    }

    // Auto-set volumeCases from linkedCases if not explicitly provided
    if (!dto.volumeCases && dto.linkedCases?.length) {
      payload.volumeCases = dto.linkedCases.length;
    }

    if (dto.invoiceDate) payload.invoiceDate = new Date(dto.invoiceDate);

    return this.model.create(payload);
  }

  async update(id: string, dto: UpdatePayoutDto) {
    const payload: Record<string, any> = { ...dto };

    if (dto.bankId && !dto.bankName) {
      const bank = await this.bankModel.findById(dto.bankId).lean();
      if (bank) payload.bankName = bank.name;
    }

    if (!dto.gstAmount && (dto.cgstAmount !== undefined || dto.sgstAmount !== undefined)) {
      const existing = await this.model.findById(id).lean();
      const cgst = dto.cgstAmount ?? (existing?.cgstAmount ?? 0);
      const sgst = dto.sgstAmount ?? (existing?.sgstAmount ?? 0);
      payload.gstAmount = cgst + sgst;
    }

    if (dto.linkedCases?.length && !dto.volumeCases) {
      payload.volumeCases = dto.linkedCases.length;
    }

    if (dto.invoiceDate) payload.invoiceDate = new Date(dto.invoiceDate);

    const doc = await this.model.findByIdAndUpdate(id, payload, { new: true }).lean();
    if (!doc) throw new NotFoundException('Payout record not found');
    return doc;
  }

  async delete(id: string) {
    await this.model.findByIdAndDelete(id);
    return { id };
  }
}
