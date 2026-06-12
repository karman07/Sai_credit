import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, ListUsersQuery } from './users.dto';
import { buildMeta, Paginated } from '../common/dto/pagination';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction } from '../common/enums';
import { AuthUser } from '../common/types';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListUsersQuery): Promise<Paginated<any>> {
    const filter: Record<string, any> = {};
    if (q.role) filter.role = q.role;
    if (q.isActive !== undefined) filter.isActive = q.isActive;
    if (q.search) {
      const rx = new RegExp(escapeRx(q.search), 'i');
      filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { employeeCode: rx }];
    }
    const [rows, total] = await Promise.all([
      this.users
        .find(filter)
        .sort({ [q.sort]: q.order === 'asc' ? 1 : -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      this.users.countDocuments(filter),
    ]);
    return { data: rows, meta: buildMeta(q.page, q.limit, total) };
  }

  async findById(id: string) {
    const user = await this.users.findById(id).lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actor: AuthUser) {
    if (await this.users.exists({ email: dto.email.toLowerCase() })) {
      throw new ConflictException('A user with this email already exists');
    }
    const { password, ...rest } = dto;
    const created = await this.users.create({
      ...rest,
      email: dto.email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      createdBy: actor.id,
    });
    await this.audit.log({
      user: actor,
      action: AuditAction.Create,
      entityType: 'user',
      entityId: created._id,
      after: created.toObject(),
    });
    return this.findById(String(created._id));
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const before = await this.users.findById(id).lean();
    if (!before) throw new NotFoundException('User not found');
    if (dto.email) dto = { ...dto, email: dto.email.toLowerCase() } as UpdateUserDto;
    const after = await this.users.findByIdAndUpdate(id, dto, { new: true }).lean();
    await this.audit.log({
      user: actor,
      action: AuditAction.Update,
      entityType: 'user',
      entityId: id,
      before,
      after: after!,
    });
    return after;
  }

  async toggleStatus(id: string, actor: AuthUser) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    user.isActive = !user.isActive;
    await user.save();
    await this.audit.log({
      user: actor,
      action: AuditAction.Update,
      entityType: 'user',
      entityId: id,
      changes: { isActive: { old: !user.isActive, new: user.isActive } } as any,
    });
    return { id, isActive: user.isActive };
  }

  /** Admin-forced password reset → returns a temporary password. */
  async adminResetPassword(id: string, actor: AuthUser) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const temp = randomBytes(6).toString('base64url');
    user.set('passwordHash', await bcrypt.hash(temp, 12));
    await user.save();
    await this.audit.log({
      user: actor,
      action: AuditAction.Update,
      entityType: 'user',
      entityId: id,
      changes: { password: { old: '••••', new: 'reset' } } as any,
    });
    return { id, temporaryPassword: temp };
  }
}

function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
