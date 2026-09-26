import type {
  Booking,
  CompanionProfile,
  Dispute,
  Escrow,
  KycSubmission,
  Message,
  Notification,
  Payout,
  Report,
  Review,
  SosAlert,
  User,
  WalletTxn,
} from '@prisma/client';
import {
  ageFromDob,
  type Availability,
  type BookingDto,
  type CompanionCardDto,
  type CompanionProfileDto,
  type DisputeDto,
  type KycSubmissionDto,
  type MessageDto,
  type NotificationDto,
  type PayoutDto,
  type ReportDto,
  type ReviewDto,
  type SosAlertDto,
  type UserDto,
  type WalletTxnDto,
} from '@companio/types';
import { signPrivateUrl } from '../files/signing';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const csv = (s: string) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const json = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export const maskPhone = (p: string | null) => (p ? `${p.slice(0, 3)}••••••${p.slice(-2)}` : null);

export function toCompanionProfileDto(c: CompanionProfile): CompanionProfileDto {
  return {
    id: c.id,
    userId: c.userId,
    headline: c.headline,
    about: c.about,
    hourlyRate: c.hourlyRate,
    categories: csv(c.categories),
    languages: csv(c.languages),
    city: c.city,
    photos: json<string[]>(c.photos, []),
    availability: json<Availability>(c.availability, {}),
    kycStatus: c.kycStatus as CompanionProfileDto['kycStatus'],
    isListed: c.isListed,
    ratingAvg: Math.round(c.ratingAvg * 10) / 10,
    ratingCount: c.ratingCount,
    completedBookings: c.completedBookings,
  };
}

export function toUserDto(u: User & { companion?: CompanionProfile | null }): UserDto {
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    name: u.name,
    dob: iso(u.dob),
    gender: u.gender as UserDto['gender'],
    city: u.city,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    role: u.role as UserDto['role'],
    status: u.status as UserDto['status'],
    onboarded: u.onboarded,
    createdAt: u.createdAt.toISOString(),
    companion: u.companion ? toCompanionProfileDto(u.companion) : null,
  };
}

export function toCompanionCard(c: CompanionProfile & { user: User }): CompanionCardDto {
  const p = toCompanionProfileDto(c);
  return {
    id: c.id,
    userId: c.userId,
    name: c.user.name ?? 'Companion',
    avatarUrl: c.user.avatarUrl,
    gender: c.user.gender as CompanionCardDto['gender'],
    age: ageFromDob(c.user.dob),
    headline: c.headline,
    hourlyRate: c.hourlyRate,
    categories: p.categories,
    languages: p.languages,
    city: c.city,
    ratingAvg: p.ratingAvg,
    ratingCount: c.ratingCount,
    completedBookings: c.completedBookings,
    verified: c.kycStatus === 'APPROVED',
  };
}

export function toReviewDto(r: Review & { author: User }): ReviewDto {
  const name = r.author.name ?? 'Member';
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    // first name + initial only — reviewers stay semi-anonymous
    authorName: name.split(' ').length > 1 ? `${name.split(' ')[0]} ${name.split(' ')[1][0]}.` : name,
    createdAt: r.createdAt.toISOString(),
  };
}

export type BookingWithRelations = Booking & {
  user: User;
  companion: User & { companion: CompanionProfile | null };
  escrow: Escrow | null;
  review?: Review | null;
  dispute?: Dispute | null;
};

export const bookingInclude = {
  user: true,
  companion: { include: { companion: true } },
  escrow: true,
  review: true,
  dispute: true,
} as const;

export function toBookingDto(b: BookingWithRelations, viewer: { id: string; role: string }): BookingDto {
  const viewerRole: BookingDto['viewerRole'] =
    viewer.role === 'ADMIN' ? 'admin' : viewer.id === b.companionUserId ? 'companion' : 'user';
  // Contact details stay hidden; phones are masked for everyone except admins.
  const phone = (p: string | null) => (viewerRole === 'admin' ? p : maskPhone(p));
  return {
    id: b.id,
    status: b.status as BookingDto['status'],
    category: b.category,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    hours: b.hours,
    meetingPoint: b.meetingPoint,
    note: b.note,
    hourlyRate: b.hourlyRate,
    subtotal: b.subtotal,
    connectionFee: b.connectionFee,
    gst: b.gst,
    total: b.total,
    commission: b.commission,
    companionPayout: b.companionPayout,
    startCode: viewerRole === 'user' || viewerRole === 'admin' ? b.startCode : null,
    user: { id: b.user.id, name: b.user.name, avatarUrl: b.user.avatarUrl, phoneMasked: phone(b.user.phone) },
    companion: {
      id: b.companion.id,
      profileId: b.companion.companion?.id ?? '',
      name: b.companion.name,
      avatarUrl: b.companion.avatarUrl,
      phoneMasked: phone(b.companion.phone),
    },
    escrow: b.escrow
      ? { amount: b.escrow.amount, status: b.escrow.status as NonNullable<BookingDto['escrow']>['status'], refunded: b.escrow.refunded, released: b.escrow.released }
      : null,
    viewerRole,
    hasReview: !!b.review,
    dispute: b.dispute ? { id: b.dispute.id, status: b.dispute.status as 'OPEN' | 'RESOLVED', reason: b.dispute.reason } : null,
    cancelReason: b.cancelReason,
    createdAt: b.createdAt.toISOString(),
    acceptedAt: iso(b.acceptedAt),
    startedAt: iso(b.startedAt),
    completedAt: iso(b.completedAt),
    cancelledAt: iso(b.cancelledAt),
  };
}

export function toMessageDto(m: Message): MessageDto {
  return {
    id: m.id,
    bookingId: m.bookingId,
    senderId: m.senderId,
    body: m.hidden ? 'This message was removed by moderation.' : m.body,
    flagged: m.flagged,
    hidden: m.hidden,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toNotificationDto(n: Notification): NotificationDto {
  return { id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, readAt: iso(n.readAt), createdAt: n.createdAt.toISOString() };
}

export function toWalletTxnDto(t: WalletTxn): WalletTxnDto {
  return { id: t.id, type: t.type as 'CREDIT' | 'DEBIT', amount: t.amount, reason: t.reason, balanceAfter: t.balanceAfter, createdAt: t.createdAt.toISOString() };
}

export function toPayoutDto(p: Payout & { user?: User }): PayoutDto {
  return {
    id: p.id,
    userId: p.userId,
    userName: p.user?.name ?? null,
    amount: p.amount,
    upiId: p.upiId,
    status: p.status as PayoutDto['status'],
    reference: p.reference,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    processedAt: iso(p.processedAt),
  };
}

export function toKycDto(k: KycSubmission & { user: User }): KycSubmissionDto {
  return {
    id: k.id,
    userId: k.userId,
    userName: k.user.name,
    userPhone: k.user.phone,
    idType: k.idType as KycSubmissionDto['idType'],
    idLast4: k.idLast4,
    idDocUrl: signPrivateUrl(k.idDocPath),
    selfieUrl: signPrivateUrl(k.selfiePath),
    status: k.status as KycSubmissionDto['status'],
    reviewNote: k.reviewNote,
    createdAt: k.createdAt.toISOString(),
    reviewedAt: iso(k.reviewedAt),
  };
}

export function toReportDto(r: Report & { reporter: User; target: User; message: Message | null }): ReportDto {
  return {
    id: r.id,
    reporter: { id: r.reporter.id, name: r.reporter.name },
    target: { id: r.target.id, name: r.target.name, status: r.target.status as ReportDto['target']['status'] },
    bookingId: r.bookingId,
    // admins see the original text even if the message was hidden
    message: r.message ? { ...toMessageDto(r.message), body: r.message.body } : null,
    reason: r.reason as ReportDto['reason'],
    details: r.details,
    status: r.status as ReportDto['status'],
    resolution: r.resolution,
    action: r.action as ReportDto['action'],
    createdAt: r.createdAt.toISOString(),
  };
}

export function toDisputeDto(d: Dispute & { raisedBy: User; booking: BookingWithRelations }, viewer: { id: string; role: string }): DisputeDto {
  return {
    id: d.id,
    bookingId: d.bookingId,
    raisedBy: { id: d.raisedBy.id, name: d.raisedBy.name },
    reason: d.reason,
    details: d.details,
    status: d.status as DisputeDto['status'],
    outcome: d.outcome as DisputeDto['outcome'],
    refundAmount: d.refundAmount,
    resolutionNote: d.resolutionNote,
    booking: toBookingDto(d.booking, viewer),
    createdAt: d.createdAt.toISOString(),
    resolvedAt: iso(d.resolvedAt),
  };
}

export function toSosDto(s: SosAlert & { user: User }): SosAlertDto {
  return {
    id: s.id,
    bookingId: s.bookingId,
    user: { id: s.user.id, name: s.user.name, phone: s.user.phone },
    lat: s.lat,
    lng: s.lng,
    status: s.status as SosAlertDto['status'],
    note: s.note,
    createdAt: s.createdAt.toISOString(),
    resolvedAt: iso(s.resolvedAt),
  };
}
