import { Global, HttpException, HttpStatus, Injectable, Module, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { companionFeeFor, formatINR, type CompanionFeeAdminDto, type CompanionFeeDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

type Tx = Prisma.TransactionClient;
type FeeFields = Pick<User, 'gender' | 'companionFeePaid' | 'companionFeePaidAt' | 'companionFeeRefundedAt'>;

const iso = (d: Date | null) => d?.toISOString() ?? null;
/** paid and not refunded since */
export const feePaid = (u: FeeFields) => !!u.companionFeePaidAt && !u.companionFeeRefundedAt;
export const toFeeAdminDto = (u: FeeFields): CompanionFeeAdminDto => ({ paidAmount: u.companionFeePaid, paidAt: iso(u.companionFeePaidAt), refundedAt: iso(u.companionFeeRefundedAt) });

/**
 * Companion registration fee. Admins switch it on per gender with an amount (GST added on top) in platform settings.
 * Paying unlocks the companion application; an admin may refund it (e.g. when rejecting verification), which closes
 * the application until the fee is paid again. Companions who applied before a fee existed are never charged.
 */
@Injectable()
export class CompanionFeeService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private wallet: WalletLedger,
    private notifications: NotificationsService,
  ) {}

  async quote(gender: string | null) {
    return companionFeeFor((await this.settings.get()) as unknown as Record<string, number>, gender);
  }

  async status(user: FeeFields): Promise<CompanionFeeDto> {
    const q = await this.quote(user.gender);
    const paid = feePaid(user);
    return { due: q.required && !paid, amount: q.amount, gst: q.gst, gstPct: q.gstPct, total: q.total, paid, ...toFeeAdminDto(user) };
  }

  /** Before creating a companion profile. */
  async assertCanApply(user: FeeFields) {
    const s = await this.status(user);
    if (s.due) throw new HttpException(`Please pay the ${formatINR(s.total)} registration fee to apply`, HttpStatus.PAYMENT_REQUIRED);
  }

  /** Before (re)submitting verification: only blocks people whose fee was refunded, never pre-fee companions. */
  async assertCanSubmitKyc(user: FeeFields) {
    if (!user.companionFeeRefundedAt) return;
    const s = await this.status(user);
    if (s.due) throw new HttpException(`Your registration fee was refunded. Pay the ${formatINR(s.total)} fee again to re-apply`, HttpStatus.PAYMENT_REQUIRED);
  }

  /** Called by payments once a fee payment is confirmed. Returns false if a fee was already paid (caller parks the money). */
  async recordPaid(tx: Tx, userId: string, total: number) {
    const res = await tx.user.updateMany({
      where: { id: userId, OR: [{ companionFeePaidAt: null }, { companionFeeRefundedAt: { not: null } }] },
      data: { companionFeePaid: total, companionFeePaidAt: new Date(), companionFeeRefundedAt: null },
    });
    return res.count === 1;
  }

  /** Admin refund to the wallet. Idempotent-safe: only a paid, unrefunded fee can be refunded. */
  async refund(tx: Tx, userId: string, reason: string) {
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('User not found');
    if (!feePaid(u) || !u.companionFeePaid) throw new BadRequestException('There is no paid registration fee to refund');
    const claimed = await tx.user.updateMany({ where: { id: userId, companionFeeRefundedAt: null }, data: { companionFeeRefundedAt: new Date() } });
    if (claimed.count !== 1) throw new BadRequestException('Already refunded');
    const promo = await this.wallet.feeRefundPromo(tx, userId, u.companionFeePaid);
    await this.wallet.credit(tx, userId, u.companionFeePaid, `Registration fee refund · ${reason}`, { type: 'companion-fee', id: userId }, promo);
    return u.companionFeePaid;
  }

  async notifyRefunded(userId: string, amount: number) {
    await this.notifications.notify(userId, {
      type: 'wallet.refund',
      title: `${formatINR(amount)} registration fee refunded 💸`,
      body: 'Your host registration fee was returned to your Companio wallet.',
      link: '/wallet',
    });
  }
}

@Global()
@Module({ providers: [CompanionFeeService], exports: [CompanionFeeService] })
export class CompanionFeeModule {}
