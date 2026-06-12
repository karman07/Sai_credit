import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer } from './schemas/customer.schema';
import {
  CreateCustomerDto, UpdateCustomerDto, ListCustomersQuery,
} from './customers.dto';
import { buildMeta, Paginated } from '../common/dto/pagination';
import { AuditService } from '../common/audit/audit.service';
import { CounterService } from '../common/counter/counter.service';
import { AuditAction, isSalesRole } from '../common/enums';
import { AuthUser } from '../common/types';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    private readonly audit: AuditService,
    private readonly counter: CounterService,
  ) {}

  /**
   * Scope injection — the security backbone. Sales roles are *always*
   * restricted to their assigned records here, in the service layer, so no
   * controller or query can bypass it.
   */
  private scopeFilter(user: AuthUser, base: Record<string, any> = {}) {
    if (isSalesRole(user.role)) {
      return { ...base, assignedTo: new Types.ObjectId(user.id) };
    }
    return base;
  }

  async list(user: AuthUser, q: ListCustomersQuery): Promise<Paginated<any>> {
    const filter: Record<string, any> = this.scopeFilter(user);
    if (q.isActive !== undefined) filter.isActive = q.isActive;
    else filter.isActive = true;
    if (q.assignedTo && !isSalesRole(user.role)) filter.assignedTo = q.assignedTo;
    if (q.leadSourceId) filter.leadSourceId = q.leadSourceId;
    if (q.customerType) filter.customerType = q.customerType;
    if (q.tag) filter.tags = q.tag;
    if (q.search) {
      const rx = new RegExp(escapeRx(q.search), 'i');
      filter.$or = [
        { firstName: rx }, { lastName: rx }, { companyName: rx },
        { customerCode: rx }, { phone: rx }, { email: rx },
      ];
    }

    const [rows, total] = await Promise.all([
      this.customers
        .find(filter)
        .sort({ [q.sort]: q.order === 'asc' ? 1 : -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate('assignedTo', 'firstName lastName')
        .lean(),
      this.customers.countDocuments(filter),
    ]);
    return { data: rows, meta: buildMeta(q.page, q.limit, total) };
  }

  async findById(user: AuthUser, id: string) {
    const doc = await this.customers
      .findOne(this.scopeFilter(user, { _id: id }))
      .populate('assignedTo', 'firstName lastName email')
      .populate('leadSourceId', 'name')
      .lean();
    if (!doc) throw new NotFoundException('Customer not found');
    return doc;
  }

  async create(user: AuthUser, dto: CreateCustomerDto) {
    const customerCode = await this.counter.code('CUS', 'customer');
    // Sales reps own what they create; admins may assign explicitly.
    const assignedTo =
      isSalesRole(user.role) ? user.id : (dto.assignedTo ?? user.id);

    const created = await this.customers.create({
      ...dto,
      customerCode,
      assignedTo: new Types.ObjectId(assignedTo),
      createdBy: new Types.ObjectId(user.id),
    });
    await this.audit.log({
      user, action: AuditAction.Create, entityType: 'customer',
      entityId: created._id, after: created.toObject(),
    });
    return this.findById(user, String(created._id));
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerDto) {
    const before = await this.customers.findOne(this.scopeFilter(user, { _id: id })).lean();
    if (!before) throw new NotFoundException('Customer not found');
    // Sales reps cannot reassign away from themselves.
    if (isSalesRole(user.role)) delete (dto as any).assignedTo;

    const after = await this.customers.findByIdAndUpdate(id, dto, { new: true }).lean();
    await this.audit.log({
      user, action: AuditAction.Update, entityType: 'customer',
      entityId: id, before, after: after!,
    });
    return after;
  }

  /** Soft delete — insurance history must be preserved. Admin only (guarded). */
  async softDelete(user: AuthUser, id: string) {
    const doc = await this.customers.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!doc) throw new NotFoundException('Customer not found');
    await this.audit.log({
      user, action: AuditAction.Delete, entityType: 'customer', entityId: id,
      changes: { isActive: { old: true, new: false } } as any,
    });
    return { id, isActive: false };
  }

  async assign(user: AuthUser, id: string, assignedTo: string) {
    const before = await this.customers.findById(id).lean();
    if (!before) throw new NotFoundException('Customer not found');
    const after = await this.customers
      .findByIdAndUpdate(id, { assignedTo: new Types.ObjectId(assignedTo) }, { new: true })
      .lean();
    await this.audit.log({
      user, action: AuditAction.Update, entityType: 'customer', entityId: id,
      changes: { assignedTo: { old: String(before.assignedTo), new: assignedTo } } as any,
    });
    return after;
  }
}

function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
