import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotifType } from './schemas/notification.schema';

export interface CreateNotifParams {
  userId: string;
  type: NotifType;
  title: string;
  message: string;
  caseId?: string;
  caseCode?: string;
}

@Injectable()
export class NotificationsService {
  constructor(@InjectModel(Notification.name) private readonly model: Model<Notification>) {}

  async notify(params: CreateNotifParams) {
    return this.model.create({
      userId: new Types.ObjectId(params.userId),
      type: params.type,
      title: params.title,
      message: params.message,
      caseId: params.caseId,
      caseCode: params.caseCode,
      isRead: false,
    });
  }

  async listForUser(userId: string, limit = 50) {
    return this.model
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async markRead(id: string, userId: string) {
    return this.model.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(userId) },
      { isRead: true },
      { new: true },
    ).lean();
  }

  async markAllRead(userId: string) {
    await this.model.updateMany({ userId: new Types.ObjectId(userId), isRead: false }, { isRead: true });
    return { ok: true };
  }

  async unreadCount(userId: string) {
    const count = await this.model.countDocuments({ userId: new Types.ObjectId(userId), isRead: false });
    return { count };
  }
}
