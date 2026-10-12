import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CaseMessage } from './schemas/case-message.schema';
import { SendCaseMessageDto } from './case-messages.dto';
import { CasesService } from '../cases/cases.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/schemas/user.schema';
import { AuthUser } from '../common/types';
import { ADMIN_PORTAL_ROLES } from '../common/enums';

@Injectable()
export class CaseMessagesService {
  constructor(
    @InjectModel(CaseMessage.name) private readonly model: Model<CaseMessage>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly cases: CasesService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  async list(caseId: string, actor: AuthUser) {
    // Reuses the case's own access rules (same as viewing the case at all).
    await this.cases.findById(caseId, actor);
    return this.model.find({ caseId: new Types.ObjectId(caseId) }).sort({ createdAt: 1 }).lean();
  }

  async send(caseId: string, dto: SendCaseMessageDto, actor: AuthUser) {
    const caseDoc = await this.cases.findById(caseId, actor);

    const message = await this.model.create({
      caseId: new Types.ObjectId(caseId),
      text: dto.text.trim(),
      attachments: dto.attachments,
      authorId: new Types.ObjectId(actor.id),
      authorName: `${actor.firstName} ${actor.lastName}`.trim(),
      authorRole: actor.role,
    });

    this.notifyParticipants(caseDoc, message, actor).catch(() => {
      /* non-blocking — don't fail the send over a notification/email hiccup */
    });

    return message.toObject();
  }

  /** Admins + this case's coordinator + its assigned rep, minus whoever just sent the message. */
  private async notifyParticipants(caseDoc: any, message: CaseMessage, actor: AuthUser) {
    const admins = await this.userModel
      .find({ role: { $in: ADMIN_PORTAL_ROLES }, isActive: true }, '_id email')
      .lean();

    const recipientIds = new Set<string>(admins.map((u) => String(u._id)));
    if (caseDoc.coordinatorId) recipientIds.add(String(caseDoc.coordinatorId));
    if (caseDoc.assignedTo) recipientIds.add(String(caseDoc.assignedTo));
    recipientIds.delete(actor.id);

    if (!recipientIds.size) return;

    const customerName = [caseDoc.customer?.firstName, caseDoc.customer?.lastName].filter(Boolean).join(' ') || '—';
    const preview = message.text || (message.attachments.length ? `[${message.attachments.length} attachment(s)]` : '');
    const title = `New Message — ${caseDoc.caseCode}`;
    const notifMessage = `${message.authorName}: ${preview}`.slice(0, 180);

    await this.notifications.notifyMany([...recipientIds], {
      type: 'case_message',
      title,
      message: notifMessage,
      caseId: String(caseDoc._id),
      caseCode: caseDoc.caseCode,
    });

    const recipientUsers = await this.userModel
      .find({ _id: { $in: [...recipientIds].map((id) => new Types.ObjectId(id)) } }, 'email')
      .lean();
    const emails = recipientUsers.map((u) => u.email).filter(Boolean);
    if (!emails.length) return;

    await this.mail.sendTemplate(
      'case_message',
      {
        caseCode: caseDoc.caseCode,
        customerName,
        authorName: message.authorName,
        messageText: message.text || '(no text)',
        attachmentCount: message.attachments.length,
      },
      emails,
    );
  }
}
