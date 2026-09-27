import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { randomInt } from 'crypto';
import type { Booking, User } from '@prisma/client';
import { REFERRAL_REWARD, type ReferralDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L, so codes survive being read aloud

/**
 * Invite-a-friend: a new user signs up with someone's code; when that friend's first booking is released
 * to the companion (i.e. a real, paid, completed session), both get REFERRAL_REWARD in their wallet — once.
 */
@Injectable()
export class ReferralsService {
  private log = new Logger('Referrals');

  constructor(
    private prisma: PrismaService,
    private ledger: WalletLedger,
    private notifications: NotificationsService,
  ) {}

  async summary(user: User): Promise<ReferralDto> {
    const [code, invited, rewarded, earned] = await Promise.all([
      this.codeFor(user),
      this.prisma.user.count({ where: { referredById: user.id } }),
      this.prisma.user.count({ where: { referredById: user.id, referralRewardedAt: { not: null } } }),
      this.prisma.walletTxn.aggregate({ where: { wallet: { userId: user.id }, refType: 'referral' }, _sum: { amount: true } }),
    ]);
    return { code, reward: REFERRAL_REWARD, invited, rewarded, earned: earned._sum.amount ?? 0 };
  }

  /** Links a just-created account to its inviter. Unknown codes are ignored rather than failing sign-up. */
  async attach(newUserId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    const referrer = await this.prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer || referrer.id === newUserId || referrer.status !== 'ACTIVE') return;
    await this.prisma.user.update({ where: { id: newUserId }, data: { referredById: referrer.id } });
  }

  /** Call after a booking's escrow is settled. Never throws: a failed reward must not fail the booking flow. */
  async onBookingReleased(booking: Booking) {
    try {
      const escrow = await this.prisma.escrow.findUnique({ where: { bookingId: booking.id } });
      if (escrow?.status !== 'RELEASED') return; // refunded or partly refunded sessions don't count
      const friend = await this.prisma.user.findUnique({ where: { id: booking.userId } });
      if (!friend?.referredById || friend.referralRewardedAt) return;
      // an inviter can't earn by being booked by their own invitee
      if (booking.companionUserId === friend.referredById) return;
      const inviter = await this.prisma.user.findUnique({ where: { id: friend.referredById } });
      if (!inviter || inviter.status !== 'ACTIVE') return;

      const paid = await this.prisma.$transaction(async (tx) => {
        // claim the reward atomically so concurrent settlements can't pay it twice
        const claimed = await tx.user.updateMany({ where: { id: friend.id, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
        if (claimed.count !== 1) return false;
        const ref = { type: 'referral', id: booking.id };
        await this.ledger.credit(tx, inviter.id, REFERRAL_REWARD, `Referral reward · ${friend.name ?? 'your friend'} completed their first booking`, ref);
        await this.ledger.credit(tx, friend.id, REFERRAL_REWARD, 'Referral reward · first booking completed', ref);
        return true;
      });
      if (!paid) return;

      await this.notifications.notify(inviter.id, {
        type: 'wallet.referral',
        title: `₹${REFERRAL_REWARD} referral reward 🎉`,
        body: `${friend.name?.split(' ')[0] ?? 'Your friend'} completed their first booking. Keep inviting!`,
        link: '/wallet',
      });
      await this.notifications.notify(friend.id, {
        type: 'wallet.referral',
        title: `₹${REFERRAL_REWARD} added to your wallet 🎁`,
        body: `Thanks for joining through ${inviter.name?.split(' ')[0] ?? 'a friend'}’s invite. Use it on your next booking.`,
        link: '/wallet',
      });
    } catch (e) {
      this.log.error(`referral reward for booking ${booking.id} failed`, e as Error);
    }
  }

  private async codeFor(user: User) {
    if (user.referralCode) return user.referralCode;
    const prefix = (user.name ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'FRIEND';
    for (let i = 0; i < 6; i++) {
      const code = prefix + Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
      // only set it if still unset (two tabs may race); a unique-constraint clash just retries with a new code
      const set = await this.prisma.user.updateMany({ where: { id: user.id, referralCode: null }, data: { referralCode: code } }).catch(() => null);
      if (set?.count === 1) return code;
      const now = await this.prisma.user.findUnique({ where: { id: user.id }, select: { referralCode: true } });
      if (now?.referralCode) return now.referralCode;
    }
    throw new Error('Could not generate a referral code');
  }
}

@Global()
@Module({ providers: [ReferralsService], exports: [ReferralsService] })
export class ReferralsModule {}
