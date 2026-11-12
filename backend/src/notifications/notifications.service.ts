import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export type NotificationType = 'NEW_LEAD' | 'LEAD_UNLOCKED' | 'NEW_QUOTE' | 'QUOTE_ACCEPTED' | 'QUOTE_DECLINED';

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string | null | undefined>;
}

/**
 * In-app notifications. Sending never throws: a failed notification must not
 * fail the matching, unlock or quote that triggered it.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  constructor(private prisma: PrismaService) {}

  async send(items: NotificationInput[]) {
    if (items.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: items.map(n => ({ userId: n.userId, type: n.type, title: n.title, body: n.body, data: (n.data ?? {}) as any })),
      });
    } catch (err) {
      this.log.error(`Could not store ${items.length} notification(s): ${(err as Error).message}`);
    }
  }

  async list(userId: string) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.unreadCount(userId),
    ]);
    return { items, unread };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Marks one notification (or, without an id, all of them) as read for this user only. */
  async markRead(userId: string, id?: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return { unread: await this.unreadCount(userId) };
  }
}
