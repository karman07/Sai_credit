import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Master } from './schemas/master.schema';
import { MasterType } from '../common/enums';
import { SLUG_TO_TYPE, CreateMasterDto, UpdateMasterDto } from './masters.dto';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction } from '../common/enums';
import { AuthUser } from '../common/types';

@Injectable()
export class MastersService {
  constructor(
    @InjectModel(Master.name) private readonly masters: Model<Master>,
    private readonly audit: AuditService,
  ) {}

  private resolveType(slug: string): MasterType {
    const type = SLUG_TO_TYPE[slug];
    if (!type) throw new BadRequestException(`Unknown master resource: ${slug}`);
    return type;
  }

  async list(slug: string, includeInactive = false, parentId?: string) {
    const type = this.resolveType(slug);
    const filter: Record<string, any> = { type };
    if (!includeInactive) filter.isActive = true;
    if (parentId) filter.parentId = parentId;
    return this.masters.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  }

  async create(slug: string, dto: CreateMasterDto, actor: AuthUser) {
    const type = this.resolveType(slug);
    if (type === MasterType.Product && !dto.code?.trim()) {
      throw new BadRequestException('Product code is required');
    }
    const created = await this.masters.create({ ...dto, type });
    await this.audit.log({
      user: actor, action: AuditAction.Create, entityType: `master:${type}`,
      entityId: created._id, after: created.toObject(),
    });
    return created.toObject();
  }

  async update(slug: string, id: string, dto: UpdateMasterDto, actor: AuthUser) {
    const type = this.resolveType(slug);
    const before = await this.masters.findOne({ _id: id, type }).lean();
    if (!before) throw new NotFoundException('Record not found');
    if (type === MasterType.Product && dto.code !== undefined && !dto.code.trim()) {
      throw new BadRequestException('Product code is required');
    }
    const after = await this.masters.findByIdAndUpdate(id, dto, { new: true }).lean();
    await this.audit.log({
      user: actor, action: AuditAction.Update, entityType: `master:${type}`,
      entityId: id, before, after: after!,
    });
    return after;
  }

  async toggleStatus(slug: string, id: string, actor: AuthUser) {
    const type = this.resolveType(slug);
    const doc = await this.masters.findOne({ _id: id, type });
    if (!doc) throw new NotFoundException('Record not found');
    doc.isActive = !doc.isActive;
    await doc.save();
    await this.audit.log({
      user: actor, action: AuditAction.Update, entityType: `master:${type}`, entityId: id,
      changes: { isActive: { old: !doc.isActive, new: doc.isActive } } as any,
    });
    return { id, isActive: doc.isActive };
  }
}
