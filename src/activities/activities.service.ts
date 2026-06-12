import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity } from './schemas/activity.schema';
import { ActivityType } from '../common/enums';
import { AuthUser } from '../common/types';

export interface LogActivityDto {
  caseId: string | Types.ObjectId;
  type: ActivityType;
  description: string;
  note?: string;
  oldStatus?: string;
  newStatus?: string;
  actor: AuthUser;
}

@Injectable()
export class ActivitiesService {
  constructor(@InjectModel(Activity.name) private readonly model: Model<Activity>) {}

  async log(dto: LogActivityDto): Promise<Activity> {
    return this.model.create({
      caseId: dto.caseId,
      type: dto.type,
      description: dto.description,
      note: dto.note,
      oldStatus: dto.oldStatus,
      newStatus: dto.newStatus,
      createdBy: dto.actor.id,
      createdByName: `${dto.actor.firstName} ${dto.actor.lastName}`.trim(),
    });
  }

  async forCase(caseId: string) {
    return this.model
      .find({ caseId: new Types.ObjectId(caseId) })
      .sort({ createdAt: -1 })
      .lean();
  }
}
