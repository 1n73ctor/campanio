import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { OffersService } from '../offers/offers.service';
import { EscrowService } from './escrow.service';

const HOUR = 3600_000;

/**
 * Time-based booking housekeeping (runs every minute):
 *  - unpaid bookings expire after 30 min
 *  - requests the companion never answered expire → full refund
 *  - accepted bookings that never started (no start code) expire after the end time + window → full refund
 *  - in-progress sessions auto-complete 2h after end
 *  - completed sessions release escrow to the companion after the dispute window
 * In production, move this to a queue worker (BullMQ on Redis) so it runs on exactly one instance.
 */
@Injectable()
export class BookingsJobs implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('BookingJobs');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private escrow: EscrowService,
    private notifications: NotificationsService,
    private referrals: ReferralsService,
    private offers: OffersService,
  ) {}

  onModuleInit() {
    if (process.env.DISABLE_JOBS === 'true') return;
    this.timer = setInterval(() => void this.tick(), 60_000);
    setTimeout(() => void this.tick(), 5_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const s = await this.settings.get();
      const now = Date.now();

      await this.prisma.booking.updateMany({
        where: { status: 'PENDING_PAYMENT', createdAt: { lt: new Date(now - 30 * 60_000) } },
        data: { status: 'EXPIRED', cancelledAt: new Date(), cancelReason: 'Payment not completed' },
      });

      const staleRequests = await this.prisma.booking.findMany({
        where: {
          status: 'REQUESTED',
          OR: [{ paidAt: { lt: new Date(now - s.requestExpiryHours * HOUR) } }, { startAt: { lt: new Date(now) } }],
        },
      });
      for (const b of staleRequests) {
        await this.prisma.$transaction(async (tx) => {
          await tx.booking.update({ where: { id: b.id }, data: { status: 'EXPIRED', cancelledAt: new Date(), cancelReason: 'Host did not respond' } });
          await this.escrow.settle(tx, b, b.total, 0, 'expired request');
        });
        await this.notifications.notify(b.userId, {
          type: 'booking.expired',
          title: 'Request expired',
          body: `No response in time — ₹${b.total} is back in your wallet. Try another host?`,
          link: `/bookings/${b.id}`,
        });
      }

      const noShows = await this.prisma.booking.findMany({
        where: { status: 'ACCEPTED', endAt: { lt: new Date(now - s.autoReleaseHours * HOUR) } },
      });
      for (const b of noShows) {
        await this.prisma.$transaction(async (tx) => {
          await tx.booking.update({ where: { id: b.id }, data: { status: 'EXPIRED', cancelledAt: new Date(), cancelReason: 'Session was never started' } });
          await this.escrow.settle(tx, b, b.total, 0, 'session not started');
        });
      }

      const overdue = await this.prisma.booking.findMany({ where: { status: 'IN_PROGRESS', endAt: { lt: new Date(now - 2 * HOUR) } } });
      for (const b of overdue) {
        await this.prisma.$transaction([
          this.prisma.booking.update({ where: { id: b.id }, data: { status: 'COMPLETED', completedAt: new Date() } }),
          this.prisma.companionProfile.update({ where: { userId: b.companionUserId }, data: { completedBookings: { increment: 1 } } }),
        ]);
      }

      const releasable = await this.prisma.booking.findMany({
        where: { status: 'COMPLETED', completedAt: { lt: new Date(now - s.autoReleaseHours * HOUR) }, escrow: { status: 'HELD' } },
      });
      for (const b of releasable) {
        await this.prisma.$transaction((tx) => this.escrow.settle(tx, b, 0, b.companionPayout, 'completed meetup'));
        await this.referrals.onBookingReleased(b);
        await this.offers.onBookingReleased(b); // cashback (only for fully released bookings)
        await this.notifications.notify(b.companionUserId, {
          type: 'booking.paid_out',
          title: `₹${b.companionPayout} added to your wallet 💸`,
          body: 'Your earnings were released after the review window.',
          link: '/companion/dashboard',
        });
      }
      const n = staleRequests.length + noShows.length + overdue.length + releasable.length;
      if (n) this.log.log(`processed ${n} meetup transitions`);
    } catch (e) {
      this.log.error(e);
    } finally {
      this.running = false;
    }
  }
}
