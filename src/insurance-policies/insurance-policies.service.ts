import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InsurancePolicy } from './schemas/insurance-policy.schema';
import { CreateInsurancePolicyDto, UpdateInsurancePolicyDto } from './insurance-policy.dto';
import { AuthUser } from '../common/types';

@Injectable()
export class InsurancePoliciesService {
  constructor(@InjectModel(InsurancePolicy.name) private readonly model: Model<InsurancePolicy>) {}

  async list(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };
    return this.model.find(filter).sort({ insurer: 1, name: 1 }).lean();
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Insurance policy not found');
    return doc;
  }

  async create(dto: CreateInsurancePolicyDto, actor: AuthUser) {
    return this.model.create({ ...dto, createdBy: actor.id });
  }

  async update(id: string, dto: UpdateInsurancePolicyDto) {
    const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('Insurance policy not found');
    return doc;
  }

  async toggleStatus(id: string) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Insurance policy not found');
    doc.isActive = !doc.isActive;
    await doc.save();
    return { id, isActive: doc.isActive };
  }

  async delete(id: string) {
    await this.model.findByIdAndUpdate(id, { isActive: false });
    return { id };
  }
}
