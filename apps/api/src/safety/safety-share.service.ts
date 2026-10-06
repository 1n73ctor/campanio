import { ForbiddenException, GoneException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { User } from '@prisma/client';
import { BOOKING_STATUS_LABEL, categoryBySlug, type BookingStatus, type SafetyShareDto, type SafetyShareViewDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { config } from '../common/config';
import { toSosDto } from '../common/mappers';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

const HOUR = 3600_000;
/** links keep working this long after the session's planned end, then stop */
const GRACE_AFTER_END = 6 * HOUR;
const SHAREABLE = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'];
const first = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || 'Someone';

/**
 * "Watch my session": a booking participant sends a private link to someone they trust. The link shows who they're
 * meeting (first name, photo, verified badge), where and when, the session status and their live location if shared,
 * and lets the contact alert the Companio safety team. No phone numbers, documents or chat are ever exposed.
 */
@Injectable()
export class SafetyShareService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private rt: RealtimeService,
  ) {}

  private async participantBooking(viewer: User, bookingId: string) {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b || (b.userId !== viewer.id && b.companionUserId !== viewer.id)) throw new NotFoundException('Meetup not found');
    return b;
  }

  private dto(s: { token: string; expiresAt: Date; createdAt: Date }): SafetyShareDto {
    return { url: `${config.webUrl}/share/${s.token}`, expiresAt: s.expiresAt.toISOString(), createdAt: s.createdAt.toISOString() };
  }

  private active(bookingId: string, userId: string) {
    return this.prisma.safetyShare.findFirst({ where: { bookingId, userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  }

  async get(viewer: User, bookingId: string): Promise<SafetyShareDto | null> {
    await this.participantBooking(viewer, bookingId);
    const s = await this.active(bookingId, viewer.id);
    return s ? this.dto(s) : null;
  }

  /** Returns the existing active link if there is one, so re-tapping "share" never multiplies links. */
  async create(viewer: User, bookingId: string): Promise<SafetyShareDto> {
    const b = await this.participantBooking(viewer, bookingId);
    if (!SHAREABLE.includes(b.status) || b.endAt.getTime() < Date.now()) throw new BadRequestException('You can share a meetup until its session ends');
    const existing = await this.active(bookingId, viewer.id);
    if (existing) return this.dto(existing);
    const s = await this.prisma.safetyShare.create({
      data: { bookingId, userId: viewer.id, token: randomBytes(24).toString('base64url'), expiresAt: new Date(b.endAt.getTime() + GRACE_AFTER_END) },
    });
    return this.dto(s);
  }

  async revoke(viewer: User, bookingId: string) {
    await this.participantBooking(viewer, bookingId);
    const res = await this.prisma.safetyShare.updateMany({ where: { bookingId, userId: viewer.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true, revoked: res.count };
  }

  private async byToken(token: string) {
    const s = await this.prisma.safetyShare.findUnique({
      where: { token },
      include: { booking: { include: { user: true, companion: { include: { companion: true } } } } },
    });
    if (!s) throw new NotFoundException('This link doesn’t exist');
    if (s.revokedAt) throw new GoneException('This link was turned off by the person who shared it');
    if (s.expiresAt.getTime() < Date.now()) throw new GoneException('This link has expired — the session is over');
    return s;
  }

  /** Public (no login): what the trusted contact sees. */
  async view(token: string): Promise<SafetyShareViewDto> {
    const s = await this.byToken(token);
    const b = s.booking;
    const sharerIsMember = s.userId === b.userId;
    const sharer = sharerIsMember ? b.user : b.companion;
    const other = sharerIsMember ? b.companion : b.user;
    const otherVerified = sharerIsMember ? b.companion.companion?.kycStatus === 'APPROVED' : !!b.user.phone;
    const [loc, openAlert] = await Promise.all([
      this.prisma.liveLocation.findUnique({ where: { bookingId_userId: { bookingId: b.id, userId: s.userId } } }),
      this.prisma.sosAlert.count({ where: { bookingId: b.id, status: 'ACTIVE' } }),
    ]);
    return {
      sharerName: first(sharer.name),
      sharerRole: sharerIsMember ? 'member' : 'companion',
      other: {
        firstName: first(other.name),
        avatarUrl: other.avatarUrl,
        verified: otherVerified,
        verifiedLabel: sharerIsMember ? (otherVerified ? 'ID-verified host' : 'Companion') : 'Phone-verified member',
      },
      activity: categoryBySlug(b.category)?.name ?? b.category,
      meetingPoint: b.meetingPoint,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      status: b.status,
      statusLabel: BOOKING_STATUS_LABEL[b.status as BookingStatus] ?? b.status,
      location: loc ? { lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt.toISOString() } : null,
      alertActive: openAlert > 0,
      expiresAt: s.expiresAt.toISOString(),
    };
  }

  /** Public (no login): the trusted contact raises a safety alert, which lands in the admin SOS queue. */
  async alert(token: string, note?: string) {
    const s = await this.byToken(token);
    const b = s.booking;
    if (!['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED', 'COMPLETED'].includes(b.status)) throw new ForbiddenException('This meetup isn’t active');
    const guidance = 'The Companio safety team has been alerted and will contact them now. If you believe they are in immediate danger, call 112.';
    const existing = await this.prisma.sosAlert.findFirst({ where: { bookingId: b.id, status: 'ACTIVE', source: 'TRUSTED_CONTACT' } });
    if (existing) return { ok: true, guidance }; // one open alert per booking is enough — avoids alarm floods

    const loc = await this.prisma.liveLocation.findUnique({ where: { bookingId_userId: { bookingId: b.id, userId: s.userId } } });
    const alert = await this.prisma.sosAlert.create({
      data: {
        bookingId: b.id,
        userId: s.userId,
        lat: loc?.lat,
        lng: loc?.lng,
        source: 'TRUSTED_CONTACT',
        note: `Raised by their trusted contact via shared link${note?.trim() ? `: ${note.trim().slice(0, 500)}` : ''}`,
      },
      include: { user: true },
    });
    this.rt.toAdmins('sos:new', toSosDto(alert));
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    const who = s.userId === b.userId ? b.user.name : b.companion.name;
    await Promise.all(
      admins.map((a) =>
        this.notifications.notify(a.id, { type: 'sos', title: '🚨 Safety alert from a trusted contact', body: `About ${who} on meetup ${b.id.slice(-6)}`, link: '/admin/sos' }),
      ),
    );
    await this.notifications.notify(s.userId, {
      type: 'sos',
      title: 'Your trusted contact alerted our safety team',
      body: 'We’re reaching out to check you’re okay. If you’re safe, reply to our team when we call.',
      link: `/bookings/${b.id}`,
    });
    return { ok: true, guidance };
  }
}
