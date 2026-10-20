import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TopUpRequest, User } from '@prisma/client';
import { randomInt } from 'crypto';
import * as QRCode from 'qrcode';
import { formatINR, type AdminTopUpDto, type TopUpRequestDto, type TopUpStartDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { AuditService } from '../common/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { config } from '../common/config';
import { PaymentsService } from '../payments/payments.service';

const MIN = 50;
const MAX = 10_000;
const MAX_OPEN = 3;
// no 0/O/1/I, so a code read off a phone screen can't be mistyped
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const dto = (r: TopUpRequest): TopUpRequestDto => ({
  id: r.id,
  amount: r.amount,
  ref: r.ref,
  note: r.note,
  utr: r.utr,
  status: r.status as TopUpRequestDto['status'],
  credited: r.credited,
  reviewNote: r.reviewNote,
  bookingId: r.bookingId,
  createdAt: r.createdAt.toISOString(),
  submittedAt: r.submittedAt?.toISOString() ?? null,
  reviewedAt: r.reviewedAt?.toISOString() ?? null,
});

/**
 * Coins by UPI QR, until the payment gateway is live: the member pays the platform's UPI ID with a note carrying their
 * name and a reference code, taps "I've paid", and an admin checks the payment in the UPI app and approves it — which
 * adds the coins (spend-only, like gateway top-ups). Every approval and rejection is audited.
 */
@Injectable()
export class TopUpsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private wallet: WalletLedger,
    private audit: AuditService,
    private notifications: NotificationsService,
    private mail: MailService,
    private payments: PaymentsService,
  ) {}

  /** How the wallet adds coins right now: UPI QR (manual approval) or the payment gateway. */
  async mode() {
    const s = await this.settings.get();
    const coins = s.chatEnabled === 1;
    // UPI QR top-ups work for meetups too, so they don't depend on paid chats being on
    const manual = s.manualTopup === 1 && !!config.upiPayee.vpa;
    return { coins, manual, payeeName: manual ? config.upiPayee.name : null, min: MIN, max: MAX };
  }

  /** `bookingId`: topping up to pay that meetup — it's paid from the wallet automatically once the top-up is approved. */
  async start(user: User, amount: number, bookingId?: string): Promise<TopUpStartDto> {
    if (!(await this.mode()).manual) throw new ForbiddenException('Adding coins by UPI QR isn’t available right now');
    if (!Number.isInteger(amount) || amount < MIN || amount > MAX) throw new BadRequestException(`Add between ${formatINR(MIN)} and ${formatINR(MAX)}`);
    if (bookingId) {
      const b = await this.prisma.booking.findUnique({ where: { id: bookingId } });
      if (!b || b.userId !== user.id || b.status !== 'PENDING_PAYMENT') throw new BadRequestException('This meetup can’t be paid any more — please request it again');
      if (b.startAt.getTime() < Date.now() + 2 * 3600_000) throw new BadRequestException('This meetup starts too soon to wait for a UPI top-up — please choose a later time');
      const { balance } = await this.wallet.balances(user.id);
      if (balance + amount < b.total) throw new BadRequestException(`Add at least ${formatINR(b.total - balance)} to cover this meetup`);
    }
    const open = await this.prisma.topUpRequest.count({ where: { userId: user.id, status: { in: ['STARTED', 'PENDING'] } } });
    if (open >= MAX_OPEN) throw new BadRequestException('You already have top-ups waiting — finish or cancel one first (Wallet → Coin top-ups)');

    let r: TopUpRequest | null = null;
    for (let i = 0; i < 5 && !r; i++) {
      const ref = `CMP-${Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')}`;
      if (await this.prisma.topUpRequest.findUnique({ where: { ref } })) continue;
      r = await this.prisma.topUpRequest.create({ data: { userId: user.id, amount, ref, note: noteFor(user.name, ref), bookingId: bookingId ?? null } });
    }
    if (!r) throw new BadRequestException('Please try again');
    const p = config.upiPayee;
    const upiLink = `upi://pay?${new URLSearchParams({ pa: p.vpa, pn: p.name, am: `${amount}.00`, cu: 'INR', tn: r.note }).toString().replace(/\+/g, '%20')}`;
    const qr = await QRCode.toDataURL(upiLink, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
    return { ...dto(r), payeeName: p.name, upiLink, qr };
  }

  /** The member says they've paid (optionally with the UPI transaction ID): it goes to the admins to check. */
  async submit(user: User, id: string, utr?: string) {
    const r = await this.own(user, id);
    if (r.status !== 'STARTED' && r.status !== 'PENDING') throw new BadRequestException('This top-up is already closed');
    const clean = utr?.replace(/\s+/g, '') || null;
    if (clean && !/^\d{12}$/.test(clean)) throw new BadRequestException('The UPI transaction ID is 12 digits (find it in your UPI app’s payment details)');
    const updated = await this.prisma.topUpRequest.update({ where: { id }, data: { status: 'PENDING', submittedAt: r.submittedAt ?? new Date(), utr: clean ?? r.utr } });
    if (r.status === 'STARTED')
      void this.mail.toAdmins(
        `Coin top-up to check: ${formatINR(r.amount)} from ${user.name ?? 'a member'}`,
        `${user.name ?? 'A member'} says they paid ${formatINR(r.amount)} to the UPI QR with the note “${r.note}”${clean ? ` (UPI transaction ID ${clean})` : ''}. Check it in the UPI app, then approve or reject it.`,
        '/admin/topups',
      );
    return dto(updated);
  }

  async cancel(user: User, id: string) {
    const r = await this.own(user, id);
    if (r.status !== 'STARTED' && r.status !== 'PENDING') throw new BadRequestException('This top-up is already closed');
    return dto(await this.prisma.topUpRequest.update({ where: { id }, data: { status: 'CANCELLED' } }));
  }

  async mine(user: User) {
    const rows = await this.prisma.topUpRequest.findMany({ where: { userId: user.id, status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'desc' }, take: 20 });
    return rows.map(dto);
  }

  private async own(user: User, id: string) {
    const r = await this.prisma.topUpRequest.findUnique({ where: { id } });
    if (!r || r.userId !== user.id) throw new NotFoundException('Top-up not found');
    return r;
  }

  // ---------- admin ----------

  async adminList(status = 'PENDING', page = 1) {
    const pageSize = 25;
    const where = status === 'ALL' ? { status: { not: 'CANCELLED' } } : { status };
    const [total, rows] = await Promise.all([
      this.prisma.topUpRequest.count({ where }),
      this.prisma.topUpRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { user: true, booking: true } }),
    ]);
    const utrs = rows.map((r) => r.utr).filter((u): u is string => !!u);
    const used = utrs.length ? await this.prisma.topUpRequest.findMany({ where: { utr: { in: utrs }, status: 'APPROVED' }, select: { id: true, utr: true, ref: true } }) : [];
    const items: AdminTopUpDto[] = rows.map((r) => ({
      ...dto(r),
      user: { id: r.user.id, name: r.user.name, phone: r.user.phone },
      forMeetup: r.booking ? { id: r.booking.id, total: r.booking.total, status: r.booking.status } : null,
      utrUsedBy: used.find((u) => u.utr === r.utr && u.id !== r.id)?.ref ?? null,
    }));
    return { items, total, page, pageSize };
  }

  /** The payment is in the UPI app: add the coins (the amount actually received, if it differs). */
  async approve(admin: User, id: string, amount?: number, note?: string) {
    const r = await this.prisma.topUpRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Top-up not found');
    const credit = amount ?? r.amount;
    if (!Number.isInteger(credit) || credit < 1 || credit > MAX) throw new BadRequestException(`Amount must be ₹1–${formatINR(MAX)}`);
    if (r.utr) {
      const dup = await this.prisma.topUpRequest.findFirst({ where: { utr: r.utr, status: 'APPROVED', id: { not: id } } });
      if (dup) throw new BadRequestException(`This UPI transaction ID was already approved for ${dup.ref} — don’t add the coins twice`);
    }
    await this.prisma.$transaction(async (tx) => {
      // only one admin can approve it, once
      const claimed = await tx.topUpRequest.updateMany({
        where: { id, status: { in: ['STARTED', 'PENDING'] } },
        data: { status: 'APPROVED', credited: credit, reviewedById: admin.id, reviewNote: note?.trim() || null, reviewedAt: new Date() },
      });
      if (!claimed.count) throw new BadRequestException('This top-up was already handled');
      await this.wallet.credit(tx, r.userId, credit, `Coins added (UPI ${r.ref})`, { type: 'topup-upi', id: r.id }, credit);
    });
    await this.audit.log(admin.id, 'topup.approve', 'topup', id, { ref: r.ref, requested: r.amount, credited: credit, utr: r.utr, note: note ?? null, bookingId: r.bookingId });
    const paid = r.bookingId ? await this.payLinkedBooking(r.userId, r.bookingId) : null;
    await this.notifications.notify(r.userId, {
      type: 'payment.captured',
      title: paid ? `Payment received — request sent to ${paid} ✅` : `${credit.toLocaleString('en-IN')} coins added`,
      body: paid
        ? `We received your UPI payment (${r.ref}) and paid your meetup from your wallet. ${paid} has been asked to accept.`
        : r.bookingId
          ? `We received your UPI payment (${r.ref}) and added it to your wallet. Open your meetup to finish booking.`
          : `We received your UPI payment (${r.ref}). Your coins are ready — use them to message hosts or pay for meetups.`,
      link: r.bookingId ? `/bookings/${r.bookingId}` : '/wallet',
    });
    return { ok: true, bookingPaid: !!paid };
  }

  /**
   * The top-up was for a meetup: pay it from the wallet now (the member already agreed to the price at checkout).
   * Returns the host's first name when the request was sent, or null if it couldn't be paid (the coins stay in the wallet).
   */
  private async payLinkedBooking(userId: string, bookingId: string) {
    try {
      const b = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { companion: true, user: true } });
      if (!b || b.userId !== userId || b.status !== 'PENDING_PAYMENT' || b.startAt.getTime() < Date.now() + 3600_000) return null;
      if ((await this.wallet.balances(userId)).balance < b.total) return null;
      const r = await this.payments.checkout(b.user, b.id, true);
      return r.status === 'PAID' ? (b.companion.name?.split(' ')[0] ?? 'the host') : null;
    } catch {
      return null; // e.g. the booking changed meanwhile — the coins simply stay in the wallet
    }
  }

  async reject(admin: User, id: string, reason: string) {
    const r = await this.prisma.topUpRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Top-up not found');
    const claimed = await this.prisma.topUpRequest.updateMany({
      where: { id, status: { in: ['STARTED', 'PENDING'] } },
      data: { status: 'REJECTED', reviewedById: admin.id, reviewNote: reason.trim(), reviewedAt: new Date() },
    });
    if (!claimed.count) throw new BadRequestException('This top-up was already handled');
    await this.audit.log(admin.id, 'topup.reject', 'topup', id, { ref: r.ref, amount: r.amount, utr: r.utr, reason });
    await this.notifications.notify(r.userId, {
      type: 'payment.parked',
      title: `Coin top-up ${r.ref} not added`,
      body: `${reason.trim()} If you did pay, reply to our email or contact support with your UPI transaction ID.`,
      link: '/wallet',
    });
    return { ok: true };
  }
}

/** "Meera K · CMP-7KQ2": first name, last initial and the code — plain characters every UPI app accepts in a note. */
function noteFor(name: string | null, ref: string) {
  const parts = (name ?? '').normalize('NFKD').replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).filter(Boolean);
  const who = parts.length ? `${parts[0].slice(0, 20)}${parts[1] ? ` ${parts[parts.length - 1][0].toUpperCase()}` : ''}` : 'Member';
  return `${who} ${ref}`;
}
