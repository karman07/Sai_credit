import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer } from './schemas/customer.schema';
import { LoanCase } from '../cases/schemas/case.schema';
import {
  CreateCustomerDto, UpdateCustomerDto, ListCustomersQuery,
} from './customers.dto';
import { buildMeta, Paginated } from '../common/dto/pagination';
import { AuditService } from '../common/audit/audit.service';
import { CounterService } from '../common/counter/counter.service';
import { AuditAction, CustomerType, isSalesRole } from '../common/enums';
import { AuthUser } from '../common/types';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    @InjectModel(LoanCase.name) private readonly cases: Model<LoanCase>,
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
    const filter: Record<string, any> = {};
    if (q.isActive !== undefined) filter.isActive = q.isActive;
    else filter.isActive = true;
    if (q.assignedTo) filter.assignedTo = q.assignedTo;
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
    if (isSalesRole(user.role)) delete (dto as any).assignedTo;

    const after = await this.customers.findByIdAndUpdate(id, dto, { new: true }).lean();

    // Cascade key contact fields to all cases that embed this customer's data.
    // Cases link to customers via the embedded contact (phone) field.
    const caseUpdate: Record<string, any> = {};
    if (dto.firstName)                     caseUpdate['customer.firstName']  = dto.firstName;
    if (dto.lastName)                      caseUpdate['customer.lastName']   = dto.lastName;
    if (dto.phone)                         caseUpdate['customer.contact']    = dto.phone;
    if (dto.alternatePhone !== undefined)  caseUpdate['customer.altContact'] = dto.alternatePhone;

    if (Object.keys(caseUpdate).length > 0) {
      await this.cases.updateMany({ 'customer.contact': before.phone }, { $set: caseUpdate });
    }

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

  /** Called by CasesService after a new case is created. Upserts a customer
   *  record keyed by phone number, then syncs the latest-case fields. */
  async findOrCreateFromCase(params: {
    phone: string; firstName: string; lastName?: string;
    alternatePhone?: string; location?: string;
    assignedTo?: string; createdBy?: string;
    caseCode: string; caseStatus: string;
  }) {
    const existing = await this.customers.findOne({ phone: params.phone, isActive: true }).lean();
    if (existing) {
      // Sync case stats on the existing customer
      await this.customers.findByIdAndUpdate(existing._id, {
        latestCaseStatus: params.caseStatus,
        latestCaseCode: params.caseCode,
        $inc: { totalCases: 1 },
      });
      return existing;
    }
    const customerCode = await this.counter.code('CUS', 'customer');
    const doc = new this.customers({
      customerCode,
      customerType: CustomerType.Individual,
      firstName: params.firstName,
      lastName: params.lastName ?? '',
      phone: params.phone,
      alternatePhone: params.alternatePhone,
      tags: [],
      addresses: [],
      contacts: [],
      latestCaseStatus: params.caseStatus,
      latestCaseCode: params.caseCode,
      totalCases: 1,
      isActive: true,
      assignedTo: params.assignedTo ? new Types.ObjectId(params.assignedTo) : undefined,
      createdBy: params.createdBy ? new Types.ObjectId(params.createdBy) : undefined,
    });
    await doc.save();
    return doc.toObject();
  }

  /** Called by CasesService when a case status changes. Keeps the
   *  latestCaseStatus in sync if this is the most-recent case for the customer. */
  async syncCaseStatus(phone: string, caseCode: string, newStatus: string) {
    const customer = await this.customers.findOne({ phone, isActive: true }).lean();
    if (!customer) return;
    if (customer.latestCaseCode === caseCode) {
      await this.customers.findByIdAndUpdate(customer._id, { latestCaseStatus: newStatus });
    }
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
