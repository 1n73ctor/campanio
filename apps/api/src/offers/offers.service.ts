import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type { Booking } from '@prisma/client';
import { formatINR, type OffersDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Member offers, set by admins in platform settings (all off by default):
 *  - welcome credit: wallet credit once per member, when they finish onboarding (18+ check done)
 *  - cashback: % of a completed booking's total back to the member's wallet, capped per booking
 * Neither method throws: an offer failing must never break onboarding or a booking.
 */
@Injectable()
export class OffersService {
  private log = new Logger('Offers');

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private wallet: WalletLedger,
    private notifications: NotificationsService,
  ) {}

  async publicTerms(): Promise<OffersDto> {
    const s = await this.settings.get();
    return { welcomeCredit: s.welcomeCredit, cashbackPct: s.cashbackPct, cashbackMax: s.cashbackMax };
  }

  async grantWelcomeCredit(userId: string) {
    try {
      const { welcomeCredit } = await this.settings.get();
      if (welcomeCredit <= 0) return;
      const paid = await this.prisma.$transaction(async (tx) => {
        // claim first, so the credit can only ever be paid once per user
        const claimed = await tx.user.updateMany({ where: { id: userId, welcomeCreditAt: null }, data: { welcomeCreditAt: new Date() } });
        if (claimed.count !== 1) return false;
        await this.wallet.credit(tx, userId, welcomeCredit, 'Welcome credit', { type: 'welcome', id: userId });
        return true;
      });
      if (!paid) return;
      await this.notifications.notify(userId, {
        type: 'wallet.welcome',
        title: `🎁 ${formatINR(welcomeCredit)} welcome credit added`,
        body: 'It’s in your wallet and comes off your first booking automatically at checkout.',
        link: '/explore',
      });
    } catch (e) {
      this.log.error(`welcome credit for ${userId} failed`, e as Error);
    }
  }

  /** Call after a booking's escrow is settled; pays cashback only when it was fully released (a real, completed session). */
  async onBookingReleased(booking: Booking) {
    try {
      const { cashbackPct, cashbackMax } = await this.settings.get();
      if (cashbackPct <= 0) return;
      const escrow = await this.prisma.escrow.findUnique({ where: { bookingId: booking.id } });
      if (escrow?.status !== 'RELEASED') return; // refunded or partly refunded sessions don't earn cashback
      const raw = Math.round((escrow.amount * cashbackPct) / 100);
      const amount = cashbackMax > 0 ? Math.min(raw, cashbackMax) : raw;
      if (amount <= 0) return;

      const paid = await this.prisma.$transaction(async (tx) => {
        const already = await tx.walletTxn.findFirst({ where: { refType: 'cashback', refId: booking.id } });
        if (already) return false;
        await this.wallet.credit(tx, booking.userId, amount, `${cashbackPct}% cashback on your booking`, { type: 'cashback', id: booking.id });
        return true;
      });
      if (!paid) return;
      await this.notifications.notify(booking.userId, {
        type: 'wallet.cashback',
        title: `💸 ${formatINR(amount)} cashback added`,
        body: 'Thanks for booking with Companio. It’s in your wallet for your next plan.',
        link: '/wallet',
      });
    } catch (e) {
      this.log.error(`cashback for booking ${booking.id} failed`, e as Error);
    }
  }
}

@Global()
@Module({ providers: [OffersService], exports: [OffersService] })
export class OffersModule {}
