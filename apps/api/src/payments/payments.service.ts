import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { User } from '@prisma/client';
import { formatINR, type CheckoutResponse, type FeeCheckoutResponse } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { EscrowService } from '../bookings/escrow.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { bookingInclude, toBookingDto } from '../common/mappers';
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/provider';
import { MockProvider } from './providers/mock.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { CashfreeProvider } from './providers/cashfree.provider';
import { CompanionFeeService } from '../companions/companion-fee.service';
import { TopUpOffersService } from './topup-offers.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Payments');
  private timer: NodeJS.Timeout | null = null;
  private reconciling = false;
  constructor(
    private prisma: PrismaService,
    private wallet: WalletLedger,
    private escrow: EscrowService,
    private notifications: NotificationsService,
    private rt: RealtimeService,
    private fee: CompanionFeeService,
    private mail: MailService,
    private offers: TopUpOffersService,
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProvider,
  ) {}

  onModuleInit() {
    if (process.env.DISABLE_JOBS === 'true' || !(this.provider instanceof RazorpayProvider)) return;
    this.timer = setInterval(() => void this.reconcile(), 2 * 60_000);
    setTimeout(() => void this.reconcile(), 20_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Safety net for payments the browser never confirmed (e.g. a phone switched to the UPI app and never came back to
   * the page) and Razorpay's webhook didn't deliver: every 2 minutes, ask Razorpay about orders still waiting from the
   * last 2 days and record the ones that were paid — with the same checks (order, amount, INR, captured).
   */
  async reconcile() {
    if (this.reconciling || !(this.provider instanceof RazorpayProvider)) return;
    this.reconciling = true;
    try {
      const now = Date.now();
      const open = await this.prisma.payment.findMany({
        where: { provider: 'razorpay', status: 'CREATED', createdAt: { gt: new Date(now - 48 * 3600_000), lt: new Date(now - 60_000) } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      });
      for (const p of open) {
        try {
          const paymentId = await this.provider.paidPaymentOf(p.providerOrderId, p.amount);
          if (!paymentId) continue;
          await this.markPaid(p.providerOrderId, paymentId);
          this.log.warn(`recovered payment ${paymentId} for ${p.providerOrderId} (${p.purpose}, ${formatINR(p.amount)}) — the browser never confirmed it`);
        } catch (e) {
          this.log.error(`reconcile ${p.providerOrderId}: ${(e as Error).message}`);
        }
      }
    } finally {
      this.reconciling = false;
    }
  }

  async checkout(user: User, bookingId: string, useWallet: boolean): Promise<CheckoutResponse> {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b || b.userId !== user.id) throw new NotFoundException('Meetup not found');
    if (b.status !== 'PENDING_PAYMENT') throw new BadRequestException('This meetup is already paid');

    const balance = useWallet ? await this.wallet.balance(user.id) : 0;
    const walletAmount = Math.min(balance, b.total);
    const external = b.total - walletAmount;

    if (external === 0) {
      const orderId = `wallet_${b.id}_${Date.now()}`;
      await this.prisma.payment.create({ data: { bookingId: b.id, userId: user.id, provider: 'wallet', providerOrderId: orderId, amount: 0, walletAmount } });
      await this.markPaid(orderId, orderId);
      return { status: 'PAID', bookingId: b.id };
    }

    const { orderId, sessionId } = await this.provider.createOrder(external, `booking_${b.id}`, customerOf(user));
    await this.prisma.payment.create({
      data: { bookingId: b.id, userId: user.id, provider: this.provider.name, providerOrderId: orderId, amount: external, walletAmount },
    });
    if (this.provider instanceof CashfreeProvider) {
      return { status: 'ACTION_REQUIRED', provider: 'cashfree', orderId, paymentSessionId: sessionId!, mode: this.provider.mode, amount: external, walletAmount };
    }
    if (this.provider instanceof RazorpayProvider) {
      return { status: 'ACTION_REQUIRED', provider: 'razorpay', orderId, amount: external, walletAmount, keyId: this.provider.keyId };
    }
    return { status: 'ACTION_REQUIRED', provider: 'mock', orderId, amount: external, walletAmount };
  }

  /** Companion registration fee: same gateway and wallet rules as bookings. */
  async checkoutCompanionFee(user: User, useWallet: boolean): Promise<FeeCheckoutResponse> {
    const fee = await this.fee.status(user);
    if (!fee.due) throw new BadRequestException(fee.paid ? 'Your registration fee is already paid' : 'No registration fee is due');

    // welcome credit, cashback and rewards are for bookings only
    const balance = useWallet ? (await this.wallet.balances(user.id)).withdrawable : 0;
    const walletAmount = Math.min(balance, fee.total);
    const external = fee.total - walletAmount;
    const base = { purpose: 'COMPANION_FEE', userId: user.id, walletAmount };

    if (external === 0) {
      const orderId = `wallet_fee_${user.id}_${Date.now()}`;
      await this.prisma.payment.create({ data: { ...base, provider: 'wallet', providerOrderId: orderId, amount: 0 } });
      await this.markPaid(orderId, orderId);
      return { status: 'PAID' };
    }
    const { orderId, sessionId } = await this.provider.createOrder(external, `fee_${user.id}`, customerOf(user));
    await this.prisma.payment.create({ data: { ...base, provider: this.provider.name, providerOrderId: orderId, amount: external } });
    if (this.provider instanceof CashfreeProvider) {
      return { status: 'ACTION_REQUIRED', provider: 'cashfree', orderId, paymentSessionId: sessionId!, mode: this.provider.mode, amount: external, walletAmount };
    }
    if (this.provider instanceof RazorpayProvider) {
      return { status: 'ACTION_REQUIRED', provider: 'razorpay', orderId, amount: external, walletAmount, keyId: this.provider.keyId };
    }
    return { status: 'ACTION_REQUIRED', provider: 'mock', orderId, amount: external, walletAmount };
  }

  /**
   * Add coins (wallet balance) through the gateway — for paid chats and meetups. Topped-up coins are spend-only, so a
   * stolen card can't be turned into a UPI payout.
   */
  async checkoutTopUp(user: User, amount: number): Promise<FeeCheckoutResponse> {
    if (!Number.isInteger(amount) || amount < TOPUP_MIN || amount > TOPUP_MAX) throw new BadRequestException(`Add between ${formatINR(TOPUP_MIN)} and ${formatINR(TOPUP_MAX)}`);
    // the bonus is decided here, by the server, and saved with the payment (an offer edited mid-payment doesn't change it)
    const best = await this.offers.best(user.id, amount);
    const base = {
      purpose: 'WALLET_TOPUP',
      userId: user.id,
      walletAmount: 0,
      ...(best ? { bonus: best.bonus, offerId: best.offer.id, offerTitle: best.offer.title, offerFirstOnly: best.offer.firstOnly } : {}),
    };
    const { orderId, sessionId } = await this.provider.createOrder(amount, `topup_${user.id}`, customerOf(user));
    await this.prisma.payment.create({ data: { ...base, provider: this.provider.name, providerOrderId: orderId, amount } });
    if (this.provider instanceof CashfreeProvider) {
      return { status: 'ACTION_REQUIRED', provider: 'cashfree', orderId, paymentSessionId: sessionId!, mode: this.provider.mode, amount, walletAmount: 0 };
    }
    if (this.provider instanceof RazorpayProvider) {
      return { status: 'ACTION_REQUIRED', provider: 'razorpay', orderId, amount, walletAmount: 0, keyId: this.provider.keyId };
    }
    return { status: 'ACTION_REQUIRED', provider: 'mock', orderId, amount, walletAmount: 0 };
  }

  /** ⭐ Premium unlock paid through the gateway (the kind and host were fixed when the payment started). */
  async checkoutPremium(user: User, kind: PremiumKind, hostUserId: string | null, price: number): Promise<FeeCheckoutResponse> {
    const meta = JSON.stringify({ kind, hostUserId });
    const { orderId, sessionId } = await this.provider.createOrder(price, `premium_${user.id}`.slice(0, 40), customerOf(user));
    await this.prisma.payment.create({ data: { purpose: 'PREMIUM', userId: user.id, walletAmount: 0, provider: this.provider.name, providerOrderId: orderId, amount: price, meta } });
    if (this.provider instanceof CashfreeProvider) return { status: 'ACTION_REQUIRED', provider: 'cashfree', orderId, paymentSessionId: sessionId!, mode: this.provider.mode, amount: price, walletAmount: 0 };
    if (this.provider instanceof RazorpayProvider) return { status: 'ACTION_REQUIRED', provider: 'razorpay', orderId, amount: price, walletAmount: 0, keyId: this.provider.keyId };
    return { status: 'ACTION_REQUIRED', provider: 'mock', orderId, amount: price, walletAmount: 0 };
  }

  private async markPremiumPaid(paymentId: string, providerPaymentId: string) {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({ where: { id: paymentId, status: { not: 'PAID' } }, data: { status: 'PAID', providerPaymentId } });
      if (claimed.count === 0) return;
      const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const m = JSON.parse(p.meta ?? '{}') as { kind?: PremiumKind; hostUserId?: string | null };
      if (!m.kind) return;
      await grantPremium(tx, { userId: p.userId, kind: m.kind, hostUserId: m.hostUserId ?? null, price: p.amount, paidWith: 'GATEWAY', paymentId: p.id });
    });
  }

  private async markTopUpPaid(paymentId: string, providerPaymentId: string) {
    const p = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({ where: { id: paymentId, status: { not: 'PAID' } }, data: { status: 'PAID', providerPaymentId } });
      if (claimed.count === 0) return null; // already processed
      const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      await this.wallet.credit(tx, p.userId, p.amount, 'Coins added', { type: 'topup', id: p.id }, p.amount);
      await this.wallet.addPaidCoins(tx, p.userId, p.amount);
      let bonus = p.bonus;
      // a "first top-up" bonus only counts if no other top-up was paid first (e.g. two started at once)
      if (bonus > 0 && p.offerFirstOnly) {
        const other = await tx.payment.count({ where: { userId: p.userId, purpose: 'WALLET_TOPUP', status: 'PAID', id: { not: p.id } } });
        if (other > 0) {
          bonus = 0;
          await tx.payment.update({ where: { id: p.id }, data: { bonus: 0 } });
        }
      }
      if (bonus > 0) await this.wallet.credit(tx, p.userId, bonus, `Bonus coins${p.offerTitle ? ` — ${p.offerTitle}` : ''}`, { type: 'topup-bonus', id: p.id }, bonus);
      return { ...p, bonus };
    });
    if (!p) return;
    // no notification: the wallet page confirms it on screen, and the wallet ledger keeps the record
    this.log.log(`wallet top-up ${formatINR(p.amount)}${p.bonus ? ` + ${p.bonus} bonus coins` : ''} by ${p.userId}`);
  }

  async verify(user: User, orderId: string, paymentId: string, signature: string) {
    const p = await this.prisma.payment.findUnique({ where: { providerOrderId: orderId } });
    if (!p || p.userId !== user.id) throw new NotFoundException('Payment not found');
    if (this.provider instanceof CashfreeProvider) {
      // Cashfree: our server asks Cashfree; the browser only tells us to look
      const r = await this.provider.confirm(orderId, p.amount);
      if (!r.paid) throw new BadRequestException('The payment isn’t complete yet. If money left your account, it’ll be confirmed automatically in a few minutes.');
      await this.markPaid(orderId, r.paymentId);
      return { status: 'PAID' as const, bookingId: p.bookingId, purpose: p.purpose };
    }
    if (p.status === 'PAID') return { status: 'PAID' as const, bookingId: p.bookingId, purpose: p.purpose };
    if (!this.provider.verifySignature(orderId, paymentId, signature)) {
      await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED' } });
      throw new BadRequestException('Payment verification failed');
    }
    // the signature proves Razorpay sent it; we still check with Razorpay what was actually paid before giving anything
    if (this.provider instanceof RazorpayProvider && !(await this.provider.confirm(paymentId, orderId, p.amount))) {
      this.log.warn(`razorpay payment ${paymentId} for ${orderId} doesn't match (expected ${formatINR(p.amount)})`);
      await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED' } });
      throw new BadRequestException('Payment verification failed');
    }
    await this.markPaid(orderId, paymentId);
    return { status: 'PAID' as const, bookingId: p.bookingId, purpose: p.purpose };
  }

  /** Dev only: simulates the gateway returning a successful payment. */
  mockPay(orderId: string) {
    if (!(this.provider instanceof MockProvider)) throw new ForbiddenException('Mock gateway disabled');
    const paymentId = `mock_pay_${Date.now()}`;
    return { orderId, paymentId, signature: this.provider.sign(orderId, paymentId) };
  }

  /** Cashfree server-to-server notice: signature checked, then the order is re-confirmed with Cashfree's API. */
  async cashfreeWebhook(rawBody: Buffer | undefined, signature: string, timestamp: string) {
    if (!(this.provider instanceof CashfreeProvider) || !rawBody || !this.provider.verifyWebhook(rawBody, signature, timestamp)) throw new ForbiddenException('Invalid webhook');
    const evt = JSON.parse(rawBody.toString('utf8')) as { data?: { order?: { order_id?: string } } };
    const orderId = evt.data?.order?.order_id;
    if (!orderId) return { ok: true };
    const p = await this.prisma.payment.findUnique({ where: { providerOrderId: orderId } });
    if (!p || p.status === 'PAID') return { ok: true };
    const r = await this.provider.confirm(orderId, p.amount);
    if (r.paid) await this.markPaid(orderId, r.paymentId);
    return { ok: true };
  }

  async webhook(rawBody: Buffer | undefined, signature: string) {
    if (!(this.provider instanceof RazorpayProvider) || !rawBody || !this.provider.verifyWebhook(rawBody, signature)) {
      throw new ForbiddenException('Invalid webhook');
    }
    const evt = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      payload?: { payment?: { entity?: { id: string; order_id: string } } };
    };
    const entity = evt.payload?.payment?.entity;
    if ((evt.event === 'payment.captured' || evt.event === 'order.paid') && entity?.order_id && entity.id) {
      const p = await this.prisma.payment.findUnique({ where: { providerOrderId: entity.order_id } });
      if (!p || p.status === 'PAID') return { ok: true };
      // re-checked with Razorpay (order, amount, currency, captured); if Razorpay can't be reached this throws, and
      // Razorpay retries the webhook later
      if (!(await this.provider.confirm(entity.id, entity.order_id, p.amount))) {
        this.log.warn(`razorpay webhook: payment ${entity.id} for ${entity.order_id} doesn't match what was ordered`);
        return { ok: true };
      }
      await this.markPaid(entity.order_id, entity.id);
    }
    return { ok: true };
  }

  /**
   * Idempotent: flips payment → PAID and debits the wallet share. Booking payments then hold escrow and move the
   * booking to REQUESTED; registration fee payments unlock the companion application.
   */
  async markPaid(orderId: string, providerPaymentId: string) {
    const p0 = await this.prisma.payment.findUnique({ where: { providerOrderId: orderId } });
    if (!p0) throw new NotFoundException('Payment not found');
    if (p0.purpose === 'COMPANION_FEE') return this.markFeePaid(p0.id, providerPaymentId);
    if (p0.purpose === 'WALLET_TOPUP') return this.markTopUpPaid(p0.id, providerPaymentId);
    if (p0.purpose === 'PREMIUM') return this.markPremiumPaid(p0.id, providerPaymentId);

    const result = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.findUniqueOrThrow({ where: { id: p0.id } });
      const claimed = await tx.payment.updateMany({ where: { id: p.id, status: { not: 'PAID' } }, data: { status: 'PAID', providerPaymentId } });
      if (claimed.count === 0) return null; // already processed

      const b = await tx.booking.findUniqueOrThrow({ where: { id: p.bookingId! } });
      if (b.status !== 'PENDING_PAYMENT') {
        // booking expired/cancelled while the user was paying → park the money in their wallet
        await this.wallet.credit(tx, b.userId, p.amount, 'Payment for an expired meetup', { type: 'payment', id: p.id });
        return { booking: b, parked: 'expired' as const };
      }
      // the wallet part was worked out at checkout; if they spent that balance in the meantime, the booking can't be
      // paid in full, so the money they just paid goes to their wallet instead (never a meetup for less than its price)
      const w = await tx.wallet.findUnique({ where: { userId: b.userId } });
      if (p.walletAmount > 0 && (w?.balance ?? 0) < p.walletAmount) {
        await this.wallet.credit(tx, b.userId, p.amount, 'Payment for a meetup your wallet could no longer cover', { type: 'payment', id: p.id });
        return { booking: b, parked: 'wallet' as const };
      }
      const promo = await this.wallet.spend(tx, b.userId, p.walletAmount, 'Meetup payment', { type: 'booking', id: b.id });
      // remembered so a refund gives the credit part back as credit, not as withdrawable money
      if (promo) await tx.payment.update({ where: { id: p.id }, data: { walletPromo: promo } });
      await this.escrow.hold(tx, b.id, b.total);
      const updated = await tx.booking.update({ where: { id: b.id }, data: { status: 'REQUESTED', paidAt: new Date() } });
      return { booking: updated, parked: null };
    });
    if (!result) return;
    const { booking, parked } = result;
    if (parked) {
      this.log.warn(`payment ${orderId} for meetup ${booking.id} credited to wallet (${parked})`);
      await this.notifications.notify(booking.userId, {
        type: 'payment.parked',
        title: 'Payment moved to your wallet',
        body:
          parked === 'wallet'
            ? 'Your wallet balance changed while you were paying, so the meetup couldn’t be fully paid. We added your payment to your Companio wallet — open the meetup and pay again.'
            : 'That meetup had expired, so we added the amount to your Companio wallet.',
        link: parked === 'wallet' ? `/checkout/${booking.id}` : '/wallet',
      });
      return;
    }
    void this.mail.sendReceipt(p0.id); // receipt with the GST breakdown, in the background
    const full = await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
    await this.notifications.notify(booking.companionUserId, {
      type: 'booking.requested',
      title: `New meetup request from ${full.user.name ?? 'a member'} 🔔`,
      body: `${booking.hours}h · ₹${booking.companionPayout} for you. Accept within a few hours.`,
      link: `/bookings/${booking.id}`,
    });
    this.rt.toUser(booking.companionUserId, 'booking:update', toBookingDto(full, { id: booking.companionUserId, role: 'COMPANION' }));
  }

  private async markFeePaid(paymentId: string, providerPaymentId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({ where: { id: paymentId, status: { not: 'PAID' } }, data: { status: 'PAID', providerPaymentId } });
      if (claimed.count === 0) return null; // already processed
      const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const total = p.amount + p.walletAmount;
      if (!(await this.fee.recordPaid(tx, p.userId, total))) {
        // fee was already paid (e.g. two tabs) → the extra gateway money goes to their wallet; the wallet share was never taken
        await this.wallet.credit(tx, p.userId, p.amount, 'Duplicate registration fee payment', { type: 'payment', id: p.id });
        return { userId: p.userId, total, duplicate: true };
      }
      // only withdrawable money pays the fee, so a refund (e.g. verification rejected) can never turn credit into cash
      await this.wallet.spend(tx, p.userId, p.walletAmount, 'Host registration fee', { type: 'companion-fee', id: p.id }, { cashOnly: true });
      return { userId: p.userId, total, duplicate: false };
    });
    if (!result) return;
    if (!result.duplicate) void this.mail.sendReceipt(paymentId);
    await this.notifications.notify(
      result.userId,
      result.duplicate
        ? { type: 'payment.parked', title: 'Payment moved to your wallet', body: 'Your registration fee was already paid, so we added this payment to your Companio wallet.', link: '/wallet' }
        : { type: 'payment.captured', title: `Registration fee received ✅`, body: `${formatINR(result.total)} paid. Finish your host application and verify your ID.`, link: '/become-a-companion' },
    );
  }
}

const TOPUP_MIN = 50;
const TOPUP_MAX = 10_000;
const customerOf = (u: User) => ({ id: u.id, phone: u.phone, name: u.name, email: u.contactEmail });

export type PremiumKind = 'HOST' | 'PASS_30' | 'LIFETIME';
type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/** Records a ⭐ Premium unlock. A 30-day pass bought while one is running adds 30 days to it. */
export async function grantPremium(tx: Tx, u: { userId: string; kind: PremiumKind; hostUserId: string | null; price: number; paidWith: 'GATEWAY' | 'COINS'; paymentId?: string }) {
  let expiresAt: Date | null = null;
  if (u.kind === 'PASS_30') {
    const running = await tx.premiumUnlock.findFirst({ where: { userId: u.userId, kind: 'PASS_30', expiresAt: { gt: new Date() } }, orderBy: { expiresAt: 'desc' } });
    expiresAt = new Date(Math.max(Date.now(), running?.expiresAt?.getTime() ?? 0) + 30 * 86_400_000);
  }
  return tx.premiumUnlock.create({ data: { userId: u.userId, kind: u.kind, hostUserId: u.kind === 'HOST' ? u.hostUserId : null, price: u.price, paidWith: u.paidWith, paymentId: u.paymentId ?? null, expiresAt } });
}
