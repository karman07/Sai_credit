import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MasterType } from '../../common/enums';

export type MasterDocument = HydratedDocument<Master>;

/**
 * Unified master-data collection. A single schema + UI pattern services all
 * 13 configurable lookups (insurers, banks, policy types, renewal statuses…).
 * Type-specific fields live as optional top-level props or in `metadata`:
 *   - city.parentId      → state
 *   - rto_office.parentId→ city  (+ metadata.stateId)
 *   - designation.parentId → department
 *   - renewal_status     → colorClass, isTerminal
 *   - vehicle_type       → category
 */
@Schema({ timestamps: true, collection: 'masters' })
export class Master {
  @Prop({ required: true, enum: MasterType, index: true })
  type!: MasterType;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  code?: string;

  @Prop({ trim: true })
  shortName?: string;

  /** Generic parent link (state→city, department→designation, etc.). */
  @Prop({ type: Types.ObjectId, ref: 'Master' })
  parentId?: Types.ObjectId;

  // renewal_status specifics
  @Prop()
  colorClass?: string;

  @Prop({ default: false })
  isTerminal?: boolean;

  // vehicle_type specific
  @Prop()
  category?: string;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const MasterSchema = SchemaFactory.createForClass(Master);
MasterSchema.index({ type: 1, sortOrder: 1 });
MasterSchema.index(
  { type: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } }
);
