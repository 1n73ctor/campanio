import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import type { AdminStatsDto, AdminUserDto, PlatformSettings } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { SettingsService } from '../common/settings.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import {
  bookingInclude,
  toBookingDto,
  toDisputeDto,
  toKycDto,
  toMessageDto,
  toPayoutDto,
  toReportDto,
  toSosDto,
  toUserDto,
} from '../common/mappers';
import { EscrowService } from '../bookings/escrow.service';
import { recomputeRating } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { OffersService } from '../offers/offers.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { PageDto, ResolveDisputeDto, ResolveReportDto } from './admin.dto';
import { CompanionFeeService, feePaid, toFeeAdminDto } from '../companions/companion-fee.service';

const PAGE = 25;
const DAY = 86_400_000;

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private settings: SettingsService,
    private wallet: WalletLedger,
    private escrow: EscrowService,
    private notifications: NotificationsService,
    private rt: RealtimeService,
    private referrals: ReferralsService,
    private fee: CompanionFeeService,
    private offers: OffersService,
  ) {}

  private page(q: PageDto) {
    const page = q.page ?? 1;
    return { page, skip: (page - 1) * PAGE, take: PAGE, pageSize: PAGE };
  }

  // ---------- dashboard ----------
  async stats(): Promise<AdminStatsDto> {
    const since = new Date(Date.now() - 13 * DAY);
    since.setHours(0, 0, 0, 0);
    const [users, companions, listed, byStatus, escrows, pendingKyc, openDisputes, openReports, activeSos, pendingPayouts, recentBookings, recentUsers] =
      await Promise.all([
        this.prisma.user.count({ where: { role: { not: 'ADMIN' }, status: { not: 'DELETED' } } }),
        this.prisma.companionProfile.count(),
        this.prisma.companionProfile.count({ where: { isListed: true } }),
        this.prisma.booking.groupBy({ by: ['status'], _count: true }),
        this.prisma.escrow.findMany({ select: { amount: true, status: true, retained: true, refunded: true } }),
        this.prisma.kycSubmission.count({ where: { status: 'PENDING' } }),
        this.prisma.dispute.count({ where: { status: 'OPEN' } }),
        this.prisma.report.count({ where: { status: 'OPEN' } }),
        this.prisma.sosAlert.count({ where: { status: 'ACTIVE' } }),
        this.prisma.payout.count({ where: { status: 'REQUESTED' } }),
        this.prisma.booking.findMany({ where: { paidAt: { gte: since } }, select: { paidAt: true, total: true } }),
        this.prisma.user.findMany({ where: { createdAt: { gte: since }, role: { not: 'ADMIN' } }, select: { createdAt: true } }),
      ]);

    const series: AdminStatsDto['series'] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * DAY);
      const key = d.toISOString().slice(0, 10);
      const sameDay = (x: Date | null) => !!x && x >= d && x.getTime() < d.getTime() + DAY;
      const day = recentBookings.filter((b) => sameDay(b.paidAt));
      series.push({ date: key, bookings: day.length, gmv: day.reduce((s, b) => s + b.total, 0), signups: recentUsers.filter((u) => sameDay(u.createdAt)).length });
    }
    return {
      users,
      companions,
      listedCompanions: listed,
      bookings: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      gmv: escrows.reduce((s, e) => s + e.amount - e.refunded, 0),
      revenue: escrows.reduce((s, e) => s + e.retained, 0),
      inEscrow: escrows.filter((e) => e.status === 'HELD' || e.status === 'FROZEN').reduce((s, e) => s + e.amount, 0),
      pendingKyc,
      openDisputes,
      openReports,
      activeSos,
      pendingPayouts,
      series,
    };
  }

  // ---------- users ----------
  async users(q: PageDto) {
    const { skip, take, page, pageSize } = this.page(q);
    const where: Prisma.UserWhereInput = {
      ...(q.role ? { role: q.role } : { role: { not: 'ADMIN' } }),
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q } }, { phone: { contains: q.q } }, { deletedPhone: { contains: q.q } }, { email: { contains: q.q } }, { contactEmail: { contains: q.q } }] } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { companion: true, wallet: true, _count: { select: { bookings: true, reportsAgainst: true } } },
      }),
    ]);
    const items: AdminUserDto[] = rows.map((u) => ({
      ...toUserDto(u),
      bookingsCount: u._count.bookings,
      reportsAgainst: u._count.reportsAgainst,
      walletBalance: u.wallet?.balance ?? 0,
      deletedAt: u.deletedAt?.toISOString() ?? null,
      deletedPhone: u.deletedPhone,
    }));
    return { items, total, page, pageSize };
  }

  /** Refund a user's companion registration fee to their wallet (any time, admin's decision). */
  async refundCompanionFee(admin: User, userId: string, note?: string) {
    const amount = await this.prisma.$transaction((tx) => this.fee.refund(tx, userId, note || 'refunded by admin'));
    await this.fee.notifyRefunded(userId, amount);
    await this.audit.log(admin.id, 'companion_fee.refund', 'user', userId, { amount, note });
    return { ok: true, amount };
  }

  async user(id: string, admin: User) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { companion: true, wallet: { include: { txns: { orderBy: { createdAt: 'desc' }, take: 30 } } }, _count: { select: { bookings: true, reportsAgainst: true } } },
    });
    if (!u) throw new NotFoundException();
    // other accounts that used the same phone number (deleted before, or re-registered after deletion)
    const numbers = [u.phone, u.deletedPhone].filter((p): p is string => !!p);
    const linked = numbers.length
      ? await this.prisma.user.findMany({
          where: { id: { not: u.id }, OR: [{ phone: { in: numbers } }, { deletedPhone: { in: numbers } }] },
          select: { id: true, name: true, status: true, createdAt: true, deletedAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const [bookings, reports, kyc] = await Promise.all([
      this.prisma.booking.findMany({
        where: { OR: [{ userId: id }, { companionUserId: id }] },
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.report.findMany({ where: { targetUserId: id }, include: { reporter: true, target: true, message: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.kycSubmission.findMany({ where: { userId: id }, include: { user: true }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      user: {
        ...toUserDto(u),
        bookingsCount: u._count.bookings,
        reportsAgainst: u._count.reportsAgainst,
        walletBalance: u.wallet?.balance ?? 0,
        companionFee: toFeeAdminDto(u),
        deletedAt: u.deletedAt?.toISOString() ?? null,
        deletedPhone: u.deletedPhone,
      },
      linkedAccounts: linked.map((l) => ({ id: l.id, name: l.name, status: l.status, createdAt: l.createdAt.toISOString(), deletedAt: l.deletedAt?.toISOString() ?? null })),
      warnings: u.warnings,
      statusReason: u.statusReason,
      wallet: u.wallet?.txns.map((t) => ({ id: t.id, type: t.type, amount: t.amount, reason: t.reason, balanceAfter: t.balanceAfter, createdAt: t.createdAt.toISOString() })) ?? [],
      bookings: bookings.map((b) => toBookingDto(b, admin)),
      reports: reports.map(toReportDto),
      kyc: kyc.map((k) => toKycDto(k, true)),
    };
  }

  async setUserStatus(admin: User, id: string, status: string, reason?: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u || u.role === 'ADMIN') throw new NotFoundException();
    // a deleted account can only be banned (which also stops its phone number from signing up again)
    if (u.deletedAt && status !== 'BANNED') throw new BadRequestException('Deleted accounts can only be banned');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { status, statusReason: status === 'ACTIVE' ? null : reason ?? null } }),
      ...(status !== 'ACTIVE' ? [this.prisma.companionProfile.updateMany({ where: { userId: id }, data: { isListed: false } })] : []),
    ]);
    await this.audit.log(admin.id, `user.${status.toLowerCase()}`, 'user', id, { reason });
    return { ok: true };
  }

  // ---------- KYC ----------
  async kycList(q: PageDto) {
    const { skip, take, page, pageSize } = this.page(q);
    const where = { status: q.status ?? 'PENDING' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.kycSubmission.count({ where }),
      this.prisma.kycSubmission.findMany({ where, include: { user: { include: { companion: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return {
      items: rows.map((k) => ({ ...toKycDto(k, true), fee: toFeeAdminDto(k.user), companion: k.user.companion ? { headline: k.user.companion.headline, city: k.user.companion.city, dob: k.user.dob?.toISOString() ?? null } : null })),
      total,
      page,
      pageSize,
    };
  }

  async kycDecide(admin: User, id: string, approve: boolean, note?: string, refundFee = false) {
    const k = await this.prisma.kycSubmission.findUnique({ where: { id } });
    if (!k) throw new NotFoundException();
    if (k.status !== 'PENDING') throw new BadRequestException('Already reviewed');
    const status = approve ? 'APPROVED' : 'REJECTED';
    // rejecting can also refund the registration fee (the admin's call); a refund means re-applying needs a new payment
    const refunded = await this.prisma.$transaction(async (tx) => {
      await tx.kycSubmission.update({ where: { id }, data: { status, reviewNote: note ?? null, reviewerId: admin.id, reviewedAt: new Date() } });
      await tx.companionProfile.update({ where: { userId: k.userId }, data: { kycStatus: status, ...(approve ? { isListed: true } : {}) } });
      return !approve && refundFee ? this.fee.refund(tx, k.userId, 'verification not approved') : 0;
    });
    if (refunded) {
      await this.fee.notifyRefunded(k.userId, refunded);
      await this.audit.log(admin.id, 'companion_fee.refund', 'user', k.userId, { amount: refunded, via: 'kyc.reject', kycId: id });
    }
    await this.notifications.notify(k.userId, approve
      ? { type: 'kyc.approved', title: "You're verified ✅ and live!", body: 'Your profile is now visible to members. Set your availability to get meetups.', link: '/companion/dashboard' }
      : { type: 'kyc.rejected', title: 'Verification needs another look', body: note ?? 'Please re-submit clearer documents.', link: '/companion/kyc' });
    await this.audit.log(admin.id, `kyc.${status.toLowerCase()}`, 'kyc', id, { note });
    return { ok: true };
  }

  // ---------- bookings ----------
  async bookings(q: PageDto, admin: User) {
    const { skip, take, page, pageSize } = this.page(q);
    const where: Prisma.BookingWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { OR: [{ id: { contains: q.q } }, { user: { name: { contains: q.q } } }, { companion: { name: { contains: q.q } } }] } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return { items: rows.map((b) => toBookingDto(b, admin)), total, page, pageSize };
  }

  async booking(id: string, admin: User) {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: bookingInclude });
    if (!b) throw new NotFoundException();
    const [messages, payments, sos, locations] = await Promise.all([
      this.prisma.message.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.payment.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.sosAlert.findMany({ where: { bookingId: id }, include: { user: true } }),
      this.prisma.liveLocation.findMany({ where: { bookingId: id } }),
    ]);
    return {
      booking: toBookingDto(b, admin),
      // admins see original text, including hidden messages
      messages: messages.map((m) => ({ ...toMessageDto(m), body: m.body, flagReason: m.flagReason })),
      payments: payments.map((p) => ({ id: p.id, provider: p.provider, orderId: p.providerOrderId, paymentId: p.providerPaymentId, amount: p.amount, walletAmount: p.walletAmount, status: p.status, createdAt: p.createdAt.toISOString() })),
      escrow: b.escrow ? { ...b.escrow, heldAt: b.escrow.heldAt.toISOString(), settledAt: b.escrow.settledAt?.toISOString() ?? null } : null,
      sos: sos.map(toSosDto),
      locations: locations.map((l) => ({ userId: l.userId, lat: l.lat, lng: l.lng, updatedAt: l.updatedAt.toISOString() })),
    };
  }

  /**
   * Refund from escrow (cancels an active booking) or, once escrow is settled, a platform-funded goodwill credit.
   */
  async refund(admin: User, id: string, note: string, amount?: number) {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { escrow: true } });
    if (!b) throw new NotFoundException();
    if (b.status === 'DISPUTED') throw new BadRequestException('Resolve the dispute instead');
    const escrowActive = b.escrow && ['HELD', 'FROZEN'].includes(b.escrow.status);
    const amt = amount ?? (escrowActive ? b.total : b.subtotal);
    if (escrowActive) {
      if (amt > b.total) throw new BadRequestException('Refund exceeds meetup total');
      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'ADMIN', cancelReason: note } });
        await this.escrow.settle(tx, b, amt, 0, 'refund by support');
      });
    } else {
      if (!b.paidAt) throw new BadRequestException('Meetup was never paid');
      if (amt > b.total) throw new BadRequestException('Refund exceeds meetup total');
      // platform-funded, so spend-only like other credit
      await this.prisma.$transaction((tx) => this.wallet.credit(tx, b.userId, amt, 'Goodwill credit from support', { type: 'booking-goodwill', id: b.id }, amt));
    }
    await this.notifications.notify(b.userId, {
      type: 'refund',
      title: escrowActive ? `₹${amt} refunded to your wallet` : `₹${amt} credit added to your wallet`,
      body: escrowActive ? note : `${note} — use it on your next meetup.`,
      link: `/bookings/${id}`,
    });
    await this.audit.log(admin.id, escrowActive ? 'booking.refund' : 'booking.goodwill', 'booking', id, { amount: amt, note });
    return { ok: true, amount: amt };
  }

  // ---------- disputes ----------
  async disputes(q: PageDto, admin: User) {
    const { skip, take, page, pageSize } = this.page(q);
    const where = { status: q.status ?? 'OPEN' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.dispute.count({ where }),
      this.prisma.dispute.findMany({ where, include: { raisedBy: true, booking: { include: bookingInclude } }, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return { items: rows.map((d) => toDisputeDto(d, admin)), total, page, pageSize };
  }

  async resolveDispute(admin: User, id: string, dto: ResolveDisputeDto) {
    const d = await this.prisma.dispute.findUnique({ where: { id }, include: { booking: true } });
    if (!d) throw new NotFoundException();
    if (d.status !== 'OPEN') throw new BadRequestException('Already resolved');
    const b = d.booking;
    const s = await this.settings.get();
    let refund = 0;
    let release = 0;
    if (dto.outcome === 'REFUND') refund = b.total;
    else if (dto.outcome === 'RELEASE') release = b.companionPayout;
    else {
      refund = dto.refundAmount ?? 0;
      if (refund <= 0 || refund >= b.subtotal) throw new BadRequestException(`Split refund must be between ₹1 and ₹${b.subtotal - 1}`);
      const remaining = b.subtotal - refund;
      release = remaining - Math.round((remaining * s.commissionPct) / 100);
    }
    await this.prisma.$transaction(async (tx) => {
      await this.escrow.settle(tx, b, refund, release, 'dispute resolution');
      await tx.dispute.update({
        where: { id },
        data: { status: 'RESOLVED', outcome: dto.outcome, refundAmount: refund, resolutionNote: dto.note, resolvedById: admin.id, resolvedAt: new Date() },
      });
      const wasCompleted = d.previousStatus === 'COMPLETED';
      await tx.booking.update({
        where: { id: b.id },
        data:
          dto.outcome === 'REFUND'
            ? { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'ADMIN', cancelReason: 'Refunded after dispute' }
            : { status: 'COMPLETED', completedAt: b.completedAt ?? new Date() },
      });
      if (dto.outcome !== 'REFUND' && !wasCompleted) {
        await tx.companionProfile.update({ where: { userId: b.companionUserId }, data: { completedBookings: { increment: 1 } } });
      }
    });
    await this.referrals.onBookingReleased(b); // only pays out if the dispute ended in a full release
    await this.offers.onBookingReleased(b); // cashback (only for fully released bookings)
    const msg = `Outcome: ${dto.outcome.toLowerCase()}. ${dto.note}`;
    await this.notifications.notify(b.userId, { type: 'dispute.resolved', title: 'Dispute resolved', body: `${msg}${refund ? ` ₹${refund} refunded.` : ''}`, link: `/bookings/${b.id}` });
    await this.notifications.notify(b.companionUserId, { type: 'dispute.resolved', title: 'Dispute resolved', body: `${msg}${release ? ` ₹${release} released to you.` : ''}`, link: `/bookings/${b.id}` });
    await this.audit.log(admin.id, 'dispute.resolve', 'dispute', id, { outcome: dto.outcome, refund, release, note: dto.note });
    return { ok: true, refund, release };
  }

  // ---------- moderation ----------
  async reports(q: PageDto) {
    const { skip, take, page, pageSize } = this.page(q);
    const where = { status: q.status ?? 'OPEN' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({ where, include: { reporter: true, target: true, message: true }, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return { items: rows.map(toReportDto), total, page, pageSize };
  }

  async resolveReport(admin: User, id: string, dto: ResolveReportDto) {
    const r = await this.prisma.report.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    if (r.status !== 'OPEN') throw new BadRequestException('Already handled');
    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id },
        data: { status: dto.action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED', action: dto.action, resolution: dto.note, handledById: admin.id, handledAt: new Date() },
      });
      if (dto.hideMessage && r.messageId) await tx.message.update({ where: { id: r.messageId }, data: { hidden: true } });
      if (dto.action === 'WARN') await tx.user.update({ where: { id: r.targetUserId }, data: { warnings: { increment: 1 } } });
      if (dto.action === 'SUSPEND' || dto.action === 'BAN') {
        await tx.user.update({ where: { id: r.targetUserId }, data: { status: dto.action === 'BAN' ? 'BANNED' : 'SUSPENDED', statusReason: dto.note } });
        await tx.companionProfile.updateMany({ where: { userId: r.targetUserId }, data: { isListed: false } });
      }
    });
    if (dto.action === 'WARN') {
      await this.notifications.notify(r.targetUserId, { type: 'moderation.warning', title: 'Community guidelines warning', body: dto.note, link: '/community-guidelines' });
    }
    await this.notifications.notify(r.reporterId, {
      type: 'report.update',
      title: 'Update on your report',
      body: dto.action === 'DISMISS' ? "We reviewed your report and didn't find a violation." : 'We reviewed your report and took action. Thank you for keeping Companio safe.',
    });
    await this.audit.log(admin.id, `report.${dto.action.toLowerCase()}`, 'report', id, { target: r.targetUserId, note: dto.note });
    return { ok: true };
  }

  async flaggedMessages(q: PageDto) {
    const { skip, take, page, pageSize } = this.page(q);
    const where = { flagged: true };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({ where, include: { sender: true }, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return {
      items: rows.map((m) => ({ ...toMessageDto(m), body: m.body, flagReason: m.flagReason, sender: { id: m.sender.id, name: m.sender.name } })),
      total,
      page,
      pageSize,
    };
  }

  async setMessageHidden(admin: User, id: string, hidden: boolean) {
    await this.prisma.message.update({ where: { id }, data: { hidden } });
    await this.audit.log(admin.id, hidden ? 'message.hide' : 'message.unhide', 'message', id);
    return { ok: true };
  }

  async reviews(q: PageDto) {
    const { skip, take, page, pageSize } = this.page(q);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.review.count(),
      this.prisma.review.findMany({ include: { author: true, target: true }, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        rating: r.rating,
        comment: r.comment,
        hidden: r.hidden,
        author: { id: r.author.id, name: r.author.name },
        target: { id: r.target.id, name: r.target.name },
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async setReviewHidden(admin: User, id: string, hidden: boolean) {
    const r = await this.prisma.review.update({ where: { id }, data: { hidden } });
    await this.prisma.$transaction((tx) => recomputeRating(tx, r.targetId));
    await this.audit.log(admin.id, hidden ? 'review.hide' : 'review.unhide', 'review', id);
    return { ok: true };
  }

  // ---------- payouts ----------
  async payouts(q: PageDto) {
    const { skip, take, page, pageSize } = this.page(q);
    const where = { status: q.status ?? 'REQUESTED' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payout.count({ where }),
      this.prisma.payout.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return { items: rows.map(toPayoutDto), total, page, pageSize };
  }

  async payoutPaid(admin: User, id: string, reference: string) {
    const p = await this.prisma.payout.findUnique({ where: { id } });
    if (!p || p.status !== 'REQUESTED') throw new BadRequestException('Payout is not pending');
    await this.prisma.payout.update({ where: { id }, data: { status: 'PAID', reference, processedBy: admin.id, processedAt: new Date() } });
    await this.notifications.notify(p.userId, { type: 'payout.paid', title: `₹${p.amount} sent to ${p.upiId} 🏦`, body: `UTR ${reference}`, link: '/wallet' });
    await this.audit.log(admin.id, 'payout.paid', 'payout', id, { reference, amount: p.amount });
    return { ok: true };
  }

  async payoutReject(admin: User, id: string, note: string) {
    const p = await this.prisma.payout.findUnique({ where: { id } });
    if (!p || p.status !== 'REQUESTED') throw new BadRequestException('Payout is not pending');
    await this.prisma.$transaction(async (tx) => {
      await tx.payout.update({ where: { id }, data: { status: 'REJECTED', note, processedBy: admin.id, processedAt: new Date() } });
      await this.wallet.credit(tx, p.userId, p.amount, 'Payout reversed', { type: 'payout', id });
    });
    await this.notifications.notify(p.userId, { type: 'payout.rejected', title: 'Payout could not be processed', body: `${note} — the amount is back in your wallet.`, link: '/wallet' });
    await this.audit.log(admin.id, 'payout.reject', 'payout', id, { note });
    return { ok: true };
  }

  // ---------- SOS ----------
  async sos(q: PageDto) {
    const rows = await this.prisma.sosAlert.findMany({
      where: q.status ? { status: q.status } : {},
      include: { user: true, booking: { include: bookingInclude } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return rows.map((s) => ({
      ...toSosDto(s),
      booking: { id: s.booking.id, meetingPoint: s.booking.meetingPoint, startAt: s.booking.startAt.toISOString(), userName: s.booking.user.name, companionName: s.booking.companion.name, status: s.booking.status },
    }));
  }

  async resolveSos(admin: User, id: string, note?: string) {
    const s = await this.prisma.sosAlert.update({ where: { id }, data: { status: 'RESOLVED', note, resolvedAt: new Date() } });
    this.rt.toAdmins('sos:resolved', { id });
    await this.audit.log(admin.id, 'sos.resolve', 'sos', id, { note, bookingId: s.bookingId });
    return { ok: true };
  }

  // ---------- settings / audit ----------
  getSettings() {
    return this.settings.get();
  }

  async updateSettings(admin: User, patch: Partial<PlatformSettings>) {
    const before = await this.settings.get();
    const after = await this.settings.update(patch);
    await this.audit.log(admin.id, 'settings.update', 'settings', 'platform', { before, after });
    return after;
  }

  async auditLog(q: PageDto) {
    const { skip, take, page, pageSize } = this.page(q);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({ include: { admin: true }, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return {
      items: rows.map((a) => ({
        id: a.id,
        admin: { id: a.admin.id, name: a.admin.name, email: a.admin.email },
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        meta: a.meta,
        createdAt: a.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
