import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { CheckoutResponse } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { EscrowService } from '../bookings/escrow.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { bookingInclude, toBookingDto } from '../common/mappers';
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/provider';
import { MockProvider } from './providers/mock.provider';
import { RazorpayProvider } from './providers/razorpay.provider';

@Injectable()
export class PaymentsService {
  private log = new Logger('Payments');
  constructor(
    private prisma: PrismaService,
    private wallet: WalletLedger,
    private escrow: EscrowService,
    private notifications: NotificationsService,
    private rt: RealtimeService,
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProvider,
  ) {}

  async checkout(user: User, bookingId: string, useWallet: boolean): Promise<CheckoutResponse> {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b || b.userId !== user.id) throw new NotFoundException('Booking not found');
    if (b.status !== 'PENDING_PAYMENT') throw new BadRequestException('This booking is already paid');

    const balance = useWallet ? await this.wallet.balance(user.id) : 0;
    const walletAmount = Math.min(balance, b.total);
    const external = b.total - walletAmount;

    if (external === 0) {
      const orderId = `wallet_${b.id}_${Date.now()}`;
      await this.prisma.payment.create({ data: { bookingId: b.id, userId: user.id, provider: 'wallet', providerOrderId: orderId, amount: 0, walletAmount } });
      await this.markPaid(orderId, orderId);
      return { status: 'PAID', bookingId: b.id };
    }

    const { orderId } = await this.provider.createOrder(external, `booking_${b.id}`);
    await this.prisma.payment.create({
      data: { bookingId: b.id, userId: user.id, provider: this.provider.name, providerOrderId: orderId, amount: external, walletAmount },
    });
    if (this.provider instanceof RazorpayProvider) {
      return { status: 'ACTION_REQUIRED', provider: 'razorpay', orderId, amount: external, walletAmount, keyId: this.provider.keyId };
    }
    return { status: 'ACTION_REQUIRED', provider: 'mock', orderId, amount: external, walletAmount };
  }

  async verify(user: User, orderId: string, paymentId: string, signature: string) {
    const p = await this.prisma.payment.findUnique({ where: { providerOrderId: orderId } });
    if (!p || p.userId !== user.id) throw new NotFoundException('Payment not found');
    if (!this.provider.verifySignature(orderId, paymentId, signature)) {
      await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED' } });
      throw new BadRequestException('Payment verification failed');
    }
    await this.markPaid(orderId, paymentId);
    return { status: 'PAID', bookingId: p.bookingId };
  }

  /** Dev only: simulates the gateway returning a successful payment. */
  mockPay(orderId: string) {
    if (!(this.provider instanceof MockProvider)) throw new ForbiddenException('Mock gateway disabled');
    const paymentId = `mock_pay_${Date.now()}`;
    return { orderId, paymentId, signature: this.provider.sign(orderId, paymentId) };
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
    if ((evt.event === 'payment.captured' || evt.event === 'order.paid') && entity?.order_id) {
      await this.markPaid(entity.order_id, entity.id);
    }
    return { ok: true };
  }

  /** Idempotent: flips payment → PAID, debits wallet share, holds escrow, moves booking to REQUESTED. */
  async markPaid(orderId: string, providerPaymentId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({ where: { providerOrderId: orderId } });
      if (!p) throw new NotFoundException('Payment not found');
      const claimed = await tx.payment.updateMany({ where: { id: p.id, status: { not: 'PAID' } }, data: { status: 'PAID', providerPaymentId } });
      if (claimed.count === 0) return null; // already processed

      const b = await tx.booking.findUniqueOrThrow({ where: { id: p.bookingId } });
      if (b.status !== 'PENDING_PAYMENT') {
        // booking expired/cancelled while the user was paying → park the money in their wallet
        await this.wallet.credit(tx, b.userId, p.amount, 'Payment for an expired booking', { type: 'payment', id: p.id });
        return { booking: b, parked: true };
      }
      await this.wallet.debit(tx, b.userId, p.walletAmount, 'Booking payment', { type: 'booking', id: b.id });
      await this.escrow.hold(tx, b.id, b.total);
      const updated = await tx.booking.update({ where: { id: b.id }, data: { status: 'REQUESTED', paidAt: new Date() } });
      return { booking: updated, parked: false };
    });
    if (!result) return;
    const { booking, parked } = result;
    if (parked) {
      this.log.warn(`payment ${orderId} arrived for non-pending booking ${booking.id}; credited to wallet`);
      await this.notifications.notify(booking.userId, {
        type: 'payment.parked',
        title: 'Payment moved to your wallet',
        body: 'That booking had expired, so we added the amount to your Companio wallet.',
        link: '/wallet',
      });
      return;
    }
    const full = await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
    await this.notifications.notify(booking.companionUserId, {
      type: 'booking.requested',
      title: `New booking request from ${full.user.name ?? 'a member'} 🔔`,
      body: `${booking.hours}h · ₹${booking.companionPayout} for you. Accept within a few hours.`,
      link: `/bookings/${booking.id}`,
    });
    this.rt.toUser(booking.companionUserId, 'booking:update', toBookingDto(full, { id: booking.companionUserId, role: 'COMPANION' }));
  }
}
