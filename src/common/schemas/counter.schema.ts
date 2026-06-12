import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CounterDocument = HydratedDocument<Counter>;

/** Atomic sequence generator for human-readable codes (CUS-2026-00001). */
@Schema({ collection: 'counters' })
export class Counter {
  @Prop({ required: true, unique: true })
  key!: string; // e.g. "customer:2026"

  @Prop({ required: true, default: 0 })
  seq!: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
