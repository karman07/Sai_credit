import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog } from '../schemas/audit-log.schema';
import { AuditAction } from '../enums';
import { AuthUser } from '../types';

interface AuditInput {
  user?: AuthUser;
  action: AuditAction;
  entityType?: string;
  entityId?: string | Types.ObjectId;
  before?: Record<string, any>;
  after?: Record<string, any>;
  /** Pre-computed diff (when before/after objects aren't convenient). */
  changes?: Record<string, { old: unknown; new: unknown }>;
  ip?: string;
  userAgent?: string;
}

/**
 * Central audit writer. Every mutation calls this — insurance data is regulated.
 * Fire-and-forget: auditing must never break the business operation.
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private readonly model: Model<AuditLog>,
  ) {}

  async log(input: AuditInput): Promise<void> {
    try {
      const changes =
        input.changes ??
        (input.before || input.after ? diff(input.before, input.after) : undefined);
      await this.model.create({
        userId: input.user ? new Types.ObjectId(input.user.id) : undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ? new Types.ObjectId(input.entityId) : undefined,
        changes,
        ipAddress: input.ip,
        userAgent: input.userAgent,
      });
    } catch {
      // swallow — never let auditing failures break the request
    }
  }
}

/** Shallow diff of changed fields only. */
function diff(before: Record<string, any> = {}, after: Record<string, any> = {}) {
  const out: Record<string, { old: unknown; new: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (['updatedAt', 'createdAt', '_id', '__v', 'searchVector'].includes(k)) continue;
    const o = before[k];
    const n = after[k];
    if (JSON.stringify(o) !== JSON.stringify(n)) out[k] = { old: o ?? null, new: n ?? null };
  }
  return out;
}
