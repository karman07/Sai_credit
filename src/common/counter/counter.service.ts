import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter } from '../schemas/counter.schema';

@Injectable()
export class CounterService {
  constructor(
    @InjectModel(Counter.name) private readonly counters: Model<Counter>,
  ) {}

  /** Returns the next sequence for a key, atomically. */
  async next(key: string): Promise<number> {
    const doc = await this.counters.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    return doc!.seq;
  }

  /** e.g. code('CUS', 'customer') → "CUS-2026-00001". */
  async code(prefix: string, scope: string): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.next(`${scope}:${year}`);
    return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  }
}
