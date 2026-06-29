import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RTORecord } from './schemas/rto-tracker.schema';
import { CreateRTODto, UpdateRTODto } from './rto-tracker.dto';
import { AuthUser } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { ChecklistItemStatus } from '../common/enums';

@Injectable()
export class RTOTrackerService {
  constructor(
    @InjectModel(RTORecord.name) private readonly model: Model<RTORecord>,
    private readonly notifications: NotificationsService,
  ) {}

  async list(caseId?: string) {
    const filter: Record<string, any> = {};
    if (caseId) filter.caseId = new Types.ObjectId(caseId);
    return this.model.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('RTO record not found');
    return doc;
  }

  async findByCaseId(caseId: string) {
    return this.model.findOne({ caseId: new Types.ObjectId(caseId) }).lean();
  }

  async create(dto: CreateRTODto, actor: AuthUser) {
    const doc = await this.model.create({
      ...dto,
      approvalDate: dto.approvalDate ? new Date(dto.approvalDate) : undefined,
      createdBy: actor.id,
    });
    return doc;
  }

  async update(id: string, dto: UpdateRTODto, actor: AuthUser) {
    const update: Record<string, any> = { ...dto };
    if (dto.approvalDate) update.approvalDate = new Date(dto.approvalDate);

    const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('RTO record not found');

    await this.checkAndNotifyComplete(doc, actor);
    return doc;
  }

  async upsertByCaseId(caseId: string, dto: UpdateRTODto, actor: AuthUser) {
    const update: Record<string, any> = {
      ...dto,
      caseId: new Types.ObjectId(caseId),
      createdBy: new Types.ObjectId(actor.id),
    };
    if (dto.approvalDate) update.approvalDate = new Date(dto.approvalDate);

    const doc = await this.model.findOneAndUpdate(
      { caseId: new Types.ObjectId(caseId) },
      update,
      { new: true, upsert: true },
    ).lean();

    await this.checkAndNotifyComplete(doc!, actor);
    return doc;
  }

  /** Auto-notify when all checklist items are Received and approval is Done */
  private async checkAndNotifyComplete(doc: any, actor: AuthUser) {
    const checklistFields = ['rtoOwnership', 'challanCheck', 'bankNocCheck', 'insuranceCheck', 'hypothecation', 'aadhaarMatch'];
    const allReceived = checklistFields.every(
      (f) => doc[f] === ChecklistItemStatus.Received || doc[f] === ChecklistItemStatus.NotRequired,
    );
    const fullyComplete = allReceived && doc.approval === 'Done' && doc.insuranceEndorsement === 'Done';

    if (fullyComplete) {
      await this.notifications.notify({
        userId: String(doc.createdBy ?? actor.id),
        type: 'rto_complete',
        title: `RTO Complete — ${doc.caseCode ?? 'Case'}`,
        message: `All RTO checks passed for ${doc.customerName ?? doc.caseCode}. Approval received and insurance endorsed.`,
        caseId: doc.caseId ? String(doc.caseId) : undefined,
        caseCode: doc.caseCode,
      });
    }
  }
}
