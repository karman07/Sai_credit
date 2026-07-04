import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser, @Query('limit') limit?: string) {
    return this.svc.listForUser(actor.id, limit ? parseInt(limit, 10) : 50);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() actor: AuthUser) {
    return this.svc.unreadCount(actor.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.markRead(id, actor.id);
  }

  @Patch(':id/unread')
  markUnread(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.svc.markUnread(id, actor.id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() actor: AuthUser) {
    return this.svc.markAllRead(actor.id);
  }
}
