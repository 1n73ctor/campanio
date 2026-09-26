import { Global, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationDto } from '../common/mappers';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private rt: RealtimeService,
  ) {}

  /**
   * In-app notification + realtime push to any open client.
   * Native push (FCM/APNs) for the mobile app plugs in here later.
   */
  async notify(userId: string, n: { type: string; title: string; body: string; link?: string }) {
    const row = await this.prisma.notification.create({ data: { userId, ...n } });
    this.rt.toUser(userId, 'notification', toNotificationDto(row));
    return row;
  }
}

@Global()
@Module({ providers: [NotificationsService, RealtimeService], exports: [NotificationsService, RealtimeService] })
export class NotificationsCoreModule {}
