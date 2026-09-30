import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Booking, Prisma, User } from '@prisma/client';
import { randomInt } from 'crypto';
import { categoryBySlug, WEEKDAYS, type Availability, type BookingDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { bookingInclude, toBookingDto, toMessageDto, toSosDto, type BookingWithRelations } from '../common/mappers';
import { filterMessage } from '../common/content-filter';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { OffersService } from '../offers/offers.service';
import { RealtimeService } from '../realtime/realtime.service';
import { EscrowService } from './escrow.service';
import type { CreateBookingDto, DisputeDto, ListBookingsDto, ReviewDto, SosDto } from './bookings.dto';

const HOUR = 3600_000;
const IST_OFFSET_MIN = 330;
const LIVE = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'];
const CHAT_OPEN = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'];

type Viewer = Pick<User, 'id' | 'role'>;

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private escrow: EscrowService,
    private notifications: NotificationsService,
    private rt: RealtimeService,
    private referrals: ReferralsService,
    private offers: OffersService,
  ) {}

  // ---------- read ----------
  async load(id: string, viewer: Viewer): Promise<BookingWithRelations> {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: bookingInclude });
    if (!b) throw new NotFoundException('Booking not found');
    if (viewer.role !== 'ADMIN' && b.userId !== viewer.id && b.companionUserId !== viewer.id) throw new NotFoundException('Booking not found');
    return b;
  }

  dto(b: BookingWithRelations, viewer: Viewer) {
    return toBookingDto(b, viewer);
  }

  async get(id: string, viewer: Viewer) {
    return this.dto(await this.load(id, viewer), viewer);
  }

  async list(viewer: Viewer, q: ListBookingsDto): Promise<BookingDto[]> {
    const who: Prisma.BookingWhereInput =
      q.as === 'companion' ? { companionUserId: viewer.id } : q.as === 'user' ? { userId: viewer.id } : { OR: [{ userId: viewer.id }, { companionUserId: viewer.id }] };
    const scope: Prisma.BookingWhereInput =
      q.scope === 'upcoming'
        ? { status: { in: ['PENDING_PAYMENT', ...LIVE, 'DISPUTED'] } }
        : q.scope === 'past'
          ? { status: { in: ['COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'] } }
          : {};
    const rows = await this.prisma.booking.findMany({
      where: { AND: [who, scope] },
      include: bookingInclude,
      orderBy: { startAt: q.scope === 'past' ? 'desc' : 'asc' },
      take: 100,
    });
    return rows.map((b) => this.dto(b, viewer));
  }

  // ---------- create ----------
  async quote(companionProfileId: string, hours: number) {
    const c = await this.prisma.companionProfile.findUnique({ where: { id: companionProfileId } });
    if (!c || !c.isListed) throw new NotFoundException('Companion not available');
    const q = await this.settings.quote(c.hourlyRate, hours);
    const { gstPct } = await this.settings.get();
    return { hourlyRate: q.hourlyRate, hours: q.hours, subtotal: q.subtotal, connectionFee: q.connectionFee, gst: q.gst, gstPct, total: q.total };
  }

  async create(user: User, dto: CreateBookingDto) {
    if (!user.onboarded) throw new BadRequestException('Complete your profile before booking');
    const c = await this.prisma.companionProfile.findUnique({ where: { id: dto.companionId }, include: { user: true } });
    if (!c || !c.isListed || c.kycStatus !== 'APPROVED' || c.user.status !== 'ACTIVE') throw new NotFoundException('Companion not available');
    if (c.userId === user.id) throw new BadRequestException("You can't book yourself");
    if (c.womenOnly && user.gender !== 'FEMALE') throw new ForbiddenException(`${c.user.name?.split(' ')[0] ?? 'This companion'} only accepts bookings from women`);
    if (!c.categories.split(',').includes(dto.category)) throw new BadRequestException(`${c.user.name} doesn't offer ${categoryBySlug(dto.category)?.name ?? dto.category}`);

    const blocked = await this.prisma.block.count({
      where: { OR: [{ blockerId: user.id, blockedId: c.userId }, { blockerId: c.userId, blockedId: user.id }] },
    });
    if (blocked) throw new ForbiddenException('You cannot book this companion');

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + dto.hours * HOUR);
    if (startAt.getTime() < Date.now() + 2 * HOUR) throw new BadRequestException('Bookings must start at least 2 hours from now');
    if (startAt.getTime() > Date.now() + 60 * 24 * HOUR) throw new BadRequestException('You can book up to 60 days ahead');
    if (!this.fitsAvailability(JSON.parse(c.availability) as Availability, startAt, endAt)) {
      throw new BadRequestException(`${c.user.name} isn't available at that time — check their weekly availability`);
    }
    await this.assertNoOverlap(c.userId, startAt, endAt);

    const q = await this.settings.quote(c.hourlyRate, dto.hours);
    const b = await this.prisma.booking.create({
      data: {
        userId: user.id,
        companionUserId: c.userId,
        category: dto.category,
        startAt,
        endAt,
        hours: dto.hours,
        meetingPoint: dto.meetingPoint.trim(),
        note: dto.note?.trim() || null,
        hourlyRate: q.hourlyRate,
        subtotal: q.subtotal,
        connectionFee: q.connectionFee,
        gst: q.gst,
        total: q.total,
        commission: q.commission,
        companionPayout: q.companionPayout,
        startCode: String(randomInt(0, 10000)).padStart(4, '0'),
      },
      include: bookingInclude,
    });
    return this.dto(b, user);
  }

  /** Availability is stored as weekly IST time windows. Empty availability = flexible. */
  private fitsAvailability(av: Availability, start: Date, end: Date) {
    const days = Object.values(av).filter((s) => s && s.length);
    if (!days.length) return true;
    const ist = (d: Date) => new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
    const s = ist(start);
    const e = ist(end);
    if (s.getUTCDate() !== e.getUTCDate() && !(e.getUTCHours() === 0 && e.getUTCMinutes() === 0)) return false;
    const day = WEEKDAYS[(s.getUTCDay() + 6) % 7];
    const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const from = hhmm(s);
    const to = s.getUTCDate() !== e.getUTCDate() ? '24:00' : hhmm(e);
    return (av[day] ?? []).some((slot) => slot.from <= from && to <= slot.to);
  }

  private async assertNoOverlap(companionUserId: string, startAt: Date, endAt: Date, excludeId?: string) {
    const clash = await this.prisma.booking.findFirst({
      where: {
        companionUserId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (clash) throw new BadRequestException('That time slot is already booked');
  }

  // ---------- transitions ----------
  private assertStatus(b: Booking, ...allowed: string[]) {
    if (!allowed.includes(b.status)) throw new BadRequestException(`Not possible while booking is ${b.status.toLowerCase().replace('_', ' ')}`);
  }

  private async emit(bookingId: string) {
    const b = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
    this.rt.toUser(b.userId, 'booking:update', toBookingDto(b, { id: b.userId, role: 'USER' }));
    this.rt.toUser(b.companionUserId, 'booking:update', toBookingDto(b, { id: b.companionUserId, role: 'COMPANION' }));
    return b;
  }

  private link(id: string) {
    return `/bookings/${id}`;
  }

  async accept(viewer: User, id: string) {
    const b = await this.load(id, viewer);
    if (b.companionUserId !== viewer.id) throw new ForbiddenException('Only the companion can accept');
    this.assertStatus(b, 'REQUESTED');
    await this.assertNoOverlap(b.companionUserId, b.startAt, b.endAt, b.id);
    await this.prisma.booking.update({ where: { id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    await this.notifications.notify(b.userId, {
      type: 'booking.accepted',
      title: `${viewer.name} accepted your booking ✅`,
      body: `See you on ${fmt(b.startAt)} at ${b.meetingPoint}.`,
      link: this.link(id),
    });
    return this.dto(await this.emit(id), viewer);
  }

  async decline(viewer: User, id: string, reason?: string) {
    const b = await this.load(id, viewer);
    if (b.companionUserId !== viewer.id) throw new ForbiddenException('Only the companion can decline');
    this.assertStatus(b, 'REQUESTED');
    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id }, data: { status: 'DECLINED', cancelReason: reason ?? null, cancelledBy: 'COMPANION', cancelledAt: new Date() } });
      await this.escrow.settle(tx, b, b.total, 0, 'declined booking');
    });
    await this.notifications.notify(b.userId, {
      type: 'booking.declined',
      title: 'Booking declined',
      body: `${viewer.name} can't make it. The full ₹${b.total}, including GST, has been refunded to your wallet.`,
      link: this.link(id),
    });
    return this.dto(await this.emit(id), viewer);
  }

  async start(viewer: User, id: string, code: string) {
    const b = await this.load(id, viewer);
    if (b.companionUserId !== viewer.id) throw new ForbiddenException('The companion starts the session with the member\'s code');
    this.assertStatus(b, 'ACCEPTED');
    if (Date.now() < b.startAt.getTime() - 30 * 60_000) throw new BadRequestException('You can start up to 30 minutes before the booking time');
    if (code !== b.startCode) throw new BadRequestException('Incorrect start code');
    await this.prisma.booking.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
    await this.notifications.notify(b.userId, {
      type: 'booking.started',
      title: 'Your session has started',
      body: 'Share your live location with a trusted contact and keep SOS handy. Have fun!',
      link: this.link(id),
    });
    return this.dto(await this.emit(id), viewer);
  }

  /**
   * User confirming completion releases escrow immediately.
   * Companion marking complete (after the end time) opens a dispute window; escrow auto-releases after it.
   */
  async complete(viewer: User, id: string) {
    const b = await this.load(id, viewer);
    const isUser = b.userId === viewer.id;
    if (isUser) this.assertStatus(b, 'IN_PROGRESS', 'COMPLETED');
    else {
      this.assertStatus(b, 'IN_PROGRESS');
      if (Date.now() < b.endAt.getTime() - 15 * 60_000) throw new BadRequestException('You can mark it complete near the end time');
    }
    if (b.status === 'COMPLETED' && b.escrow?.status !== 'HELD') throw new BadRequestException('Already completed');

    await this.prisma.$transaction(async (tx) => {
      if (b.status !== 'COMPLETED') {
        await tx.booking.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
        await tx.companionProfile.update({ where: { userId: b.companionUserId }, data: { completedBookings: { increment: 1 } } });
      }
      if (isUser) await this.escrow.settle(tx, b, 0, b.companionPayout, 'completed booking');
    });
    if (isUser) {
      await this.referrals.onBookingReleased(b);
      await this.offers.onBookingReleased(b); // cashback (only for fully released bookings)
      await this.notifications.notify(b.companionUserId, {
        type: 'booking.paid_out',
        title: `₹${b.companionPayout} added to your wallet 💸`,
        body: `${viewer.name} confirmed the session. Thanks for being awesome.`,
        link: '/companion/dashboard',
      });
    } else {
      await this.notifications.notify(b.userId, {
        type: 'booking.completed',
        title: 'How was it? ⭐',
        body: 'Confirm the session and leave a review. Something wrong? Raise it within 24h.',
        link: this.link(id),
      });
    }
    return this.dto(await this.emit(id), viewer);
  }

  async cancel(viewer: User, id: string, reason?: string) {
    const b = await this.load(id, viewer);
    const s = await this.settings.get();
    const byUser = b.userId === viewer.id;
    this.assertStatus(b, 'PENDING_PAYMENT', 'REQUESTED', 'ACCEPTED');
    if (!byUser && b.status === 'PENDING_PAYMENT') throw new ForbiddenException('Not allowed');

    let refund = 0;
    let release = 0;
    let summary = '';
    if (b.status === 'REQUESTED' || !byUser) {
      // before acceptance, or whenever the companion cancels: everything back, connection fee and GST included
      refund = b.total;
      summary = `Full refund of ₹${refund} (including GST)`;
    } else if (b.status === 'ACCEPTED') {
      const hoursLeft = (b.startAt.getTime() - Date.now()) / HOUR;
      if (hoursLeft >= s.freeCancelHours) {
        refund = b.subtotal;
        summary = `₹${refund} refunded (the connection fee and GST are non-refundable after acceptance)`;
      } else {
        refund = Math.round((b.subtotal * s.lateCancelRefundPct) / 100);
        const remaining = b.subtotal - refund;
        release = remaining - Math.round((remaining * s.commissionPct) / 100);
        summary = `Late cancellation: ₹${refund} refunded`;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: reason ?? null, cancelledBy: byUser ? 'USER' : 'COMPANION', cancelledAt: new Date() },
      });
      if (b.status !== 'PENDING_PAYMENT') await this.escrow.settle(tx, b, refund, release, 'cancelled booking');
      if (!byUser && b.status === 'ACCEPTED') {
        // late companion cancellations count against them
        await tx.user.update({ where: { id: viewer.id }, data: { warnings: { increment: 1 } } });
      }
    });
    if (b.status !== 'PENDING_PAYMENT') {
      const other = byUser ? b.companionUserId : b.userId;
      await this.notifications.notify(other, {
        type: 'booking.cancelled',
        title: 'Booking cancelled',
        body: byUser ? `${viewer.name} cancelled.${release ? ` ₹${release} late-cancellation fee credited to you.` : ''}` : `${viewer.name} cancelled. ${summary} to your wallet.`,
        link: this.link(id),
      });
    }
    return { ...this.dto(await this.emit(id), viewer), summary };
  }

  async dispute(viewer: User, id: string, dto: DisputeDto) {
    const b = await this.load(id, viewer);
    this.assertStatus(b, 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED');
    if (b.dispute) throw new BadRequestException('A dispute already exists for this booking');
    if (b.escrow?.status !== 'HELD') throw new BadRequestException('The dispute window for this booking has closed');
    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.create({ data: { bookingId: id, raisedById: viewer.id, reason: dto.reason, details: dto.details, previousStatus: b.status } });
      await tx.booking.update({ where: { id }, data: { status: 'DISPUTED' } });
      await this.escrow.freeze(tx, id);
    });
    const other = b.userId === viewer.id ? b.companionUserId : b.userId;
    await this.notifications.notify(other, {
      type: 'booking.disputed',
      title: 'A dispute was raised',
      body: 'Payment is on hold while our team reviews. We may reach out to you.',
      link: this.link(id),
    });
    this.rt.toAdmins('dispute:new', { bookingId: id });
    return this.dto(await this.emit(id), viewer);
  }

  async review(viewer: User, id: string, dto: ReviewDto) {
    const b = await this.load(id, viewer);
    if (b.userId !== viewer.id) throw new ForbiddenException('Only the member can review this booking');
    this.assertStatus(b, 'COMPLETED');
    if (b.review) throw new BadRequestException('Already reviewed');
    await this.prisma.$transaction(async (tx) => {
      await tx.review.create({ data: { bookingId: id, authorId: viewer.id, targetId: b.companionUserId, rating: dto.rating, comment: dto.comment?.trim() || null } });
      await recomputeRating(tx, b.companionUserId);
    });
    await this.notifications.notify(b.companionUserId, {
      type: 'review.new',
      title: `New ${dto.rating}★ review`,
      body: dto.comment ? `“${dto.comment.slice(0, 80)}”` : `${viewer.name} left you a rating.`,
      link: '/companion/dashboard',
    });
    return this.dto(await this.emit(id), viewer);
  }

  // ---------- safety ----------
  async sos(viewer: User, id: string, dto: SosDto) {
    const b = await this.load(id, viewer);
    this.assertStatus(b, 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED');
    const alert = await this.prisma.sosAlert.create({
      data: { bookingId: id, userId: viewer.id, lat: dto.lat, lng: dto.lng, note: dto.note },
      include: { user: true },
    });
    this.rt.toAdmins('sos:new', toSosDto(alert));
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await Promise.all(
      admins.map((a) =>
        this.notifications.notify(a.id, { type: 'sos', title: '🚨 SOS alert', body: `${viewer.name} triggered SOS on booking ${id.slice(-6)}`, link: `/admin/sos` }),
      ),
    );
    return { alert: toSosDto(alert), guidance: 'Our safety team has been alerted. If you are in immediate danger, call 112 now.' };
  }

  async updateLocation(viewer: User, id: string, lat: number, lng: number) {
    const b = await this.load(id, viewer);
    this.assertStatus(b, 'ACCEPTED', 'IN_PROGRESS');
    const loc = await this.prisma.liveLocation.upsert({
      where: { bookingId_userId: { bookingId: id, userId: viewer.id } },
      create: { bookingId: id, userId: viewer.id, lat, lng },
      update: { lat, lng },
    });
    const payload = { bookingId: id, userId: viewer.id, lat, lng, updatedAt: loc.updatedAt.toISOString() };
    this.rt.toBooking(id, 'location:update', payload);
    await this.prisma.sosAlert.updateMany({ where: { bookingId: id, userId: viewer.id, status: 'ACTIVE' }, data: { lat, lng } });
    return payload;
  }

  async locations(viewer: User, id: string) {
    await this.load(id, viewer);
    const rows = await this.prisma.liveLocation.findMany({ where: { bookingId: id } });
    return rows.map((l) => ({ bookingId: id, userId: l.userId, lat: l.lat, lng: l.lng, updatedAt: l.updatedAt.toISOString() }));
  }

  // ---------- chat ----------
  async messages(viewer: Viewer, id: string) {
    await this.load(id, viewer);
    const rows = await this.prisma.message.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'asc' }, take: 500 });
    return rows.map(toMessageDto);
  }

  async sendMessage(viewer: Viewer, id: string, body: string) {
    const b = await this.load(id, viewer);
    if (viewer.role === 'ADMIN') throw new ForbiddenException('Admins cannot post in member chats');
    if (!CHAT_OPEN.includes(b.status)) throw new BadRequestException('Chat opens once the booking is paid');
    if (b.status === 'COMPLETED' && b.completedAt && Date.now() - b.completedAt.getTime() > 48 * HOUR) {
      throw new BadRequestException('This chat is now closed');
    }
    const other = b.userId === viewer.id ? b.companionUserId : b.userId;
    const blocked = await this.prisma.block.count({ where: { OR: [{ blockerId: viewer.id, blockedId: other }, { blockerId: other, blockedId: viewer.id }] } });
    if (blocked) throw new ForbiddenException('You can no longer message this person');

    const f = filterMessage(body);
    if (!f.body) throw new BadRequestException('Message is empty');
    const m = await this.prisma.message.create({ data: { bookingId: id, senderId: viewer.id, body: f.body, flagged: f.flagged, flagReason: f.reason } });
    const dto = toMessageDto(m);
    this.rt.toBooking(id, 'message:new', dto);
    this.rt.toUser(other, 'message:new', dto);
    if (f.reason?.includes('explicit')) this.rt.toAdmins('message:flagged', dto);
    return { message: dto, warning: f.flagged ? 'For your safety, contact details and off-platform payment info are hidden. Keep it platonic.' : null };
  }
}

export async function recomputeRating(tx: Prisma.TransactionClient, companionUserId: string) {
  const agg = await tx.review.aggregate({ where: { targetId: companionUserId, hidden: false }, _avg: { rating: true }, _count: true });
  await tx.companionProfile.update({
    where: { userId: companionUserId },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
  });
}

const fmt = (d: Date) =>
  d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
