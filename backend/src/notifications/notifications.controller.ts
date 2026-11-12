import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/index';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Latest 50 notifications for the signed-in user, plus the unread count' })
  list(@CurrentUser() user: any) {
    return this.notifications.list(user.sub);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: any) {
    return { unread: await this.notifications.unreadCount(user.sub) };
  }

  @Post('read')
  @ApiOperation({ summary: 'Mark all notifications read' })
  readAll(@CurrentUser() user: any) {
    return this.notifications.markRead(user.sub);
  }

  @Post(':id/read')
  readOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notifications.markRead(user.sub, id);
  }
}
