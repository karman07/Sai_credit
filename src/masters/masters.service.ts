import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Master } from './schemas/master.schema';
import { MasterType, CaseStatus } from '../common/enums';
import { SLUG_TO_TYPE, CreateMasterDto, UpdateMasterDto, ReorderMasterDto } from './masters.dto';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction } from '../common/enums';
import { AuthUser } from '../common/types';
import { hasPermission } from '../rbac/permissions';

@Injectable()
export class MastersService implements OnModuleInit {
  constructor(
    @InjectModel(Master.name) private readonly masters: Model<Master>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Seeds the built-in CaseStatus enum values as real Master documents (once)
   * so they can share drag-and-drop ordering with custom statuses — the
   * Cases pages read status order straight off this catalog. Idempotent: a
   * no-op once every built-in already exists, so manual reordering by admins
   * is never clobbered on restart.
   */
  async onModuleInit() {
    const builtIns = Object.values(CaseStatus);
    const existing = await this.masters.find({ type: MasterType.CaseStatus }).lean();
    const existingBuiltInNames = new Set(existing.filter((e) => e.isBuiltIn).map((e) => e.name));
    if (builtIns.every((name) => existingBuiltInNames.has(name))) return;

    const customs = existing
      .filter((e) => !e.isBuiltIn)
      .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));

    const ops: any[] = builtIns.map((name, index) => ({
      updateOne: {
        filter: { type: MasterType.CaseStatus, name },
        update: {
          $set: { isBuiltIn: true },
          $setOnInsert: { isActive: true, sortOrder: index },
        },
        upsert: true,
      },
    }));
    customs.forEach((c, i) => {
      ops.push({
        updateOne: { filter: { _id: c._id }, update: { $set: { sortOrder: builtIns.length + i } } },
      });
    });
    if (ops.length) await this.masters.bulkWrite(ops);
  }

  private resolveType(slug: string): MasterType {
    const type = SLUG_TO_TYPE[slug];
    if (!type) throw new BadRequestException(`Unknown master resource: ${slug}`);
    return type;
  }

  /**
   * Write access to the Data Catalog is resource-scoped: `master.manage` grants
   * every resource, while `document_types.manage` (held by sales roles) only
   * covers the Document Types catalog. Kept here rather than a route-level
   * @RequirePermissions since the permission needed depends on the `:resource`
   * param.
   */
  private assertCanManage(slug: string, actor: AuthUser) {
    if (hasPermission(actor, 'master.manage')) return;
    if (slug === 'document-types' && hasPermission(actor, 'document_types.manage')) return;
    throw new ForbiddenException('You do not have permission to manage this catalog');
  }

  async list(slug: string, includeInactive = false, parentId?: string) {
    const type = this.resolveType(slug);
    const filter: Record<string, any> = { type };
    if (!includeInactive) filter.isActive = true;
    if (parentId) filter.parentId = parentId;
    return this.masters.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  }

  async create(slug: string, dto: CreateMasterDto, actor: AuthUser) {
    this.assertCanManage(slug, actor);
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
    this.assertCanManage(slug, actor);
    const type = this.resolveType(slug);
    const before = await this.masters.findOne({ _id: id, type }).lean();
    if (!before) throw new NotFoundException('Record not found');
    if (type === MasterType.Product && dto.code !== undefined && !dto.code.trim()) {
      throw new BadRequestException('Product code is required');
    }
    if (before.isBuiltIn && dto.name !== undefined && dto.name !== before.name) {
      throw new BadRequestException('Built-in statuses cannot be renamed');
    }
    const after = await this.masters.findByIdAndUpdate(id, dto, { new: true }).lean();
    await this.audit.log({
      user: actor, action: AuditAction.Update, entityType: `master:${type}`,
      entityId: id, before, after: after!,
    });
    return after;
  }

  /**
   * Persists a drag-and-drop reorder: `orderedIds` is the full list of this
   * catalog's items in their new top-to-bottom order. Every form/dropdown
   * that reads this resource sorts by `sortOrder` (see `list` above), so the
   * new order takes effect everywhere automatically — no per-form changes.
   */
  async reorder(slug: string, dto: ReorderMasterDto, actor: AuthUser) {
    this.assertCanManage(slug, actor);
    const type = this.resolveType(slug);
    await this.masters.bulkWrite(
      dto.orderedIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id, type },
          update: { $set: { sortOrder: index } },
        },
      })),
    );
    await this.audit.log({
      user: actor, action: AuditAction.Update, entityType: `master:${type}:reorder`,
      after: { orderedIds: dto.orderedIds } as any,
    });
    return this.list(slug, true);
  }

  async toggleStatus(slug: string, id: string, actor: AuthUser) {
    this.assertCanManage(slug, actor);
    const type = this.resolveType(slug);
    const doc = await this.masters.findOne({ _id: id, type });
    if (!doc) throw new NotFoundException('Record not found');
    if (doc.isBuiltIn) {
      throw new ForbiddenException('Built-in statuses cannot be deactivated');
    }
    doc.isActive = !doc.isActive;
    await doc.save();
    await this.audit.log({
      user: actor, action: AuditAction.Update, entityType: `master:${type}`, entityId: id,
      changes: { isActive: { old: !doc.isActive, new: doc.isActive } } as any,
    });
    return { id, isActive: doc.isActive };
  }
}
