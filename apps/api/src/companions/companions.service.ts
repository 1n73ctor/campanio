import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CompanionProfile, Prisma, User } from '@prisma/client';
import { WEEKDAYS, type CompanionDetailDto, type CompanionDashboardDto, type Paginated, type CompanionCardDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import {
  bookingInclude,
  toBookingDto,
  toCompanionCard,
  toCompanionProfileDto,
  toKycDto,
  toPayoutDto,
  toReviewDto,
} from '../common/mappers';
import { NotificationsService } from '../notifications/notifications.service';
import type { ApplyDto, SearchDto, UpdateProfileDto } from './companions.dto';
import { CompanionFeeService } from './companion-fee.service';
import { BADGE_HORIZON, availabilityBadges } from './availability';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class CompanionsService {
  constructor(
    private prisma: PrismaService,
    private wallet: WalletLedger,
    private notifications: NotificationsService,
    private fee: CompanionFeeService,
  ) {}

  async search(q: SearchDto): Promise<Paginated<CompanionCardDto>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 12;
    const where: Prisma.CompanionProfileWhereInput = {
      isListed: true,
      kycStatus: 'APPROVED',
      user: { status: 'ACTIVE', ...(q.gender ? { gender: q.gender } : {}) },
      ...(q.city ? { city: q.city } : {}),
      ...(q.category ? { categories: { contains: q.category } } : {}),
      ...(q.language ? { languages: { contains: q.language } } : {}),
      ...(q.minPrice || q.maxPrice ? { hourlyRate: { gte: q.minPrice ?? 0, lte: q.maxPrice ?? 1_000_000 } } : {}),
      ...(q.q
        ? { OR: [{ headline: { contains: q.q } }, { about: { contains: q.q } }, { user: { name: { contains: q.q } } }] }
        : {}),
    };
    const orderBy: Prisma.CompanionProfileOrderByWithRelationInput[] =
      q.sort === 'price_asc'
        ? [{ hourlyRate: 'asc' }]
        : q.sort === 'price_desc'
          ? [{ hourlyRate: 'desc' }]
          : q.sort === 'newest'
            ? [{ createdAt: 'desc' }]
            : q.sort === 'rating'
              ? [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }]
              : [{ ratingAvg: 'desc' }, { completedBookings: 'desc' }, { createdAt: 'desc' }];
    if (q.when) {
      // availability lives in JSON, so filter in memory (a city's listed companions is a small set), then paginate
      const all = await this.prisma.companionProfile.findMany({ where, orderBy, include: { user: true }, take: 1000 });
      const cards = await this.withBadges(all);
      const matching = cards.filter((c) => (q.when === 'today' ? c.freeToday : c.freeWeekend));
      return { items: matching.slice((page - 1) * pageSize, page * pageSize), total: matching.length, page, pageSize };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.companionProfile.count({ where }),
      this.prisma.companionProfile.findMany({ where, orderBy, include: { user: true }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items: await this.withBadges(rows), total, page, pageSize };
  }

  /** Cards with "free today" / "free this weekend" badges, from weekly hours minus confirmed bookings. */
  private async withBadges(rows: (CompanionProfile & { user: User })[]): Promise<CompanionCardDto[]> {
    if (!rows.length) return [];
    const now = Date.now();
    const busy = await this.prisma.booking.findMany({
      // same statuses that block a new booking (BookingsService.assertNoOverlap)
      where: { companionUserId: { in: rows.map((r) => r.userId) }, status: { in: ['ACCEPTED', 'IN_PROGRESS'] }, endAt: { gt: new Date(now) }, startAt: { lt: new Date(now + BADGE_HORIZON) } },
      select: { companionUserId: true, startAt: true, endAt: true },
    });
    return rows.map((r) => ({ ...toCompanionCard(r), ...availabilityBadges(r.availability, busy.filter((b) => b.companionUserId === r.userId), now) }));
  }

  async detail(id: string): Promise<CompanionDetailDto> {
    const c = await this.prisma.companionProfile.findUnique({ where: { id }, include: { user: true } });
    if (!c || !c.isListed || c.kycStatus !== 'APPROVED' || c.user.status !== 'ACTIVE') throw new NotFoundException('Companion not found');
    const reviews = await this.prisma.review.findMany({
      where: { targetId: c.userId, hidden: false },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const p = toCompanionProfileDto(c);
    const [card] = await this.withBadges([c]);
    return {
      ...card,
      about: c.about,
      photos: p.photos,
      availability: p.availability,
      bio: c.user.bio,
      memberSince: c.createdAt.toISOString(),
      reviews: reviews.map(toReviewDto),
    };
  }

  async apply(user: User, dto: ApplyDto) {
    if (!user.onboarded) throw new BadRequestException('Complete your profile first');
    const existing = await this.prisma.companionProfile.findUnique({ where: { userId: user.id } });
    if (existing) throw new BadRequestException('You already have a companion profile');
    await this.fee.assertCanApply(user);
    const [profile] = await this.prisma.$transaction([
      this.prisma.companionProfile.create({
        data: {
          userId: user.id,
          headline: dto.headline,
          about: dto.about,
          hourlyRate: dto.hourlyRate,
          categories: dto.categories.join(','),
          languages: dto.languages.join(','),
          city: dto.city,
          availability: JSON.stringify({ sat: [{ from: '10:00', to: '20:00' }], sun: [{ from: '10:00', to: '20:00' }] }),
        },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { role: 'COMPANION' } }),
    ]);
    await this.notifications.notify(user.id, {
      type: 'companion.applied',
      title: 'Welcome aboard! 🎉',
      body: 'Next step: verify your identity so we can list your profile.',
      link: '/companion/kyc',
    });
    return toCompanionProfileDto(profile);
  }

  private async own(userId: string) {
    const p = await this.prisma.companionProfile.findUnique({ where: { userId } });
    if (!p) throw new ForbiddenException('You are not a companion yet');
    return p;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.own(userId);
    if (dto.womenOnly) {
      const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (u.gender !== 'FEMALE') throw new BadRequestException('Women-only bookings are available to women companions');
    }
    const p = await this.prisma.companionProfile.update({
      where: { userId },
      data: {
        headline: dto.headline,
        about: dto.about,
        hourlyRate: dto.hourlyRate,
        categories: dto.categories?.join(','),
        languages: dto.languages?.join(','),
        city: dto.city,
        womenOnly: dto.womenOnly,
      },
    });
    return toCompanionProfileDto(p);
  }

  async setAvailability(userId: string, availability: Record<string, { from: string; to: string }[]>) {
    await this.own(userId);
    const clean: Record<string, { from: string; to: string }[]> = {};
    for (const day of WEEKDAYS) {
      const slots = availability[day];
      if (!Array.isArray(slots) || !slots.length) continue;
      for (const s of slots) {
        if (!TIME.test(s?.from) || !TIME.test(s?.to) || s.from >= s.to) throw new BadRequestException(`Invalid time slot on ${day}`);
      }
      clean[day] = slots.slice(0, 4).map((s) => ({ from: s.from, to: s.to }));
    }
    const p = await this.prisma.companionProfile.update({ where: { userId }, data: { availability: JSON.stringify(clean) } });
    return toCompanionProfileDto(p);
  }

  async setListed(userId: string, listed: boolean) {
    const p = await this.own(userId);
    if (listed && p.kycStatus !== 'APPROVED') throw new BadRequestException('Your ID verification must be approved before you go live');
    return toCompanionProfileDto(await this.prisma.companionProfile.update({ where: { userId }, data: { isListed: listed } }));
  }

  async addPhoto(userId: string, url: string) {
    const p = await this.own(userId);
    const photos = JSON.parse(p.photos) as string[];
    if (photos.length >= 6) throw new BadRequestException('Up to 6 photos');
    photos.push(url);
    return toCompanionProfileDto(await this.prisma.companionProfile.update({ where: { userId }, data: { photos: JSON.stringify(photos) } }));
  }

  async removePhoto(userId: string, index: number) {
    const p = await this.own(userId);
    const photos = (JSON.parse(p.photos) as string[]).filter((_, i) => i !== index);
    return toCompanionProfileDto(await this.prisma.companionProfile.update({ where: { userId }, data: { photos: JSON.stringify(photos) } }));
  }

  async submitKyc(user: User, idType: string, idLast4: string, idDocFile: string, selfieFile: string) {
    const p = await this.own(user.id);
    if (p.kycStatus === 'PENDING') throw new BadRequestException('Your verification is already under review');
    if (p.kycStatus === 'APPROVED') throw new BadRequestException('You are already verified');
    await this.fee.assertCanSubmitKyc(user);
    const [k] = await this.prisma.$transaction([
      this.prisma.kycSubmission.create({
        data: { userId: user.id, idType, idLast4: idLast4.toUpperCase(), idDocPath: idDocFile, selfiePath: selfieFile },
        include: { user: true },
      }),
      this.prisma.companionProfile.update({ where: { userId: user.id }, data: { kycStatus: 'PENDING' } }),
    ]);
    return toKycDto(k);
  }

  async dashboard(user: User): Promise<CompanionDashboardDto> {
    const profile = await this.own(user.id);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [pending, upcoming, escrowAgg, lifetime, month, payouts, kyc, balance] = await Promise.all([
      this.prisma.booking.findMany({ where: { companionUserId: user.id, status: 'REQUESTED' }, include: bookingInclude, orderBy: { startAt: 'asc' } }),
      this.prisma.booking.findMany({
        where: { companionUserId: user.id, status: { in: ['ACCEPTED', 'IN_PROGRESS'] } },
        include: bookingInclude,
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.booking.aggregate({
        where: { companionUserId: user.id, status: { in: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED'] } },
        _sum: { companionPayout: true },
      }),
      this.earnings(user.id),
      this.earnings(user.id, monthStart),
      this.prisma.payout.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.kycSubmission.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, include: { user: true } }),
      this.wallet.balance(user.id),
    ]);
    return {
      profile: toCompanionProfileDto(profile),
      walletBalance: balance,
      inEscrow: escrowAgg._sum.companionPayout ?? 0,
      lifetimeEarnings: lifetime,
      thisMonthEarnings: month,
      pendingRequests: pending.map((b) => toBookingDto(b, user)),
      upcoming: upcoming.map((b) => toBookingDto(b, user)),
      payouts: payouts.map(toPayoutDto),
      latestKyc: kyc ? toKycDto(kyc) : null,
    };
  }

  private async earnings(userId: string, since?: Date) {
    const agg = await this.prisma.walletTxn.aggregate({
      where: { wallet: { userId }, type: 'CREDIT', refType: 'booking-earning', ...(since ? { createdAt: { gte: since } } : {}) },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }
}
