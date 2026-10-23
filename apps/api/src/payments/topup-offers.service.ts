import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, TopUpOffer } from '@prisma/client';
import type { CoinPurchaseDto, CoinPurchaseSummaryDto, TopUpOfferDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';

const DAY = 86_400_000;
export const toOfferDto = (o: TopUpOffer): TopUpOfferDto => ({
  id: o.id,
  title: o.title,
  minAmount: o.minAmount,
  bonusPct: o.bonusPct,
  maxBonus: o.maxBonus,
  firstOnly: o.firstOnly,
  startsAt: o.startsAt?.toISOString() ?? null,
  endsAt: o.endsAt?.toISOString() ?? null,
  active: o.active,
});
const bonusOf = (o: { bonusPct: number; maxBonus: number | null }, amount: number) => Math.min(Math.floor((amount * o.bonusPct) / 100), o.maxBonus ?? Infinity);

/**
 * Bonus coins on top-ups: the admin sets offers (e.g. ₹1,000+ → +10%); the best one that applies is worked out by the
 * server when the payment starts and saved on it, so nothing the browser sends can change the bonus.
 */
@Injectable()
export class TopUpOffersService {
  constructor(private prisma: PrismaService) {}

  private live(now = new Date()): Prisma.TopUpOfferWhereInput {
    return { active: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] };
  }

  hasToppedUp(userId: string, exceptPaymentId?: string) {
    return this.prisma.payment
      .count({ where: { userId, purpose: 'WALLET_TOPUP', status: 'PAID', ...(exceptPaymentId ? { id: { not: exceptPaymentId } } : {}) } })
      .then((n) => n > 0);
  }

  /** Offers this member can use right now (first-top-up ones only until their first top-up). */
  async forMember(userId: string) {
    const [offers, done] = await Promise.all([this.prisma.topUpOffer.findMany({ where: this.live(), orderBy: { minAmount: 'asc' } }), this.hasToppedUp(userId)]);
    return offers.filter((o) => !o.firstOnly || !done).map(toOfferDto);
  }

  /** The best bonus for this top-up (0 if none applies). */
  async best(userId: string, amount: number) {
    const offers = (await this.forMember(userId)).filter((o) => amount >= o.minAmount);
    let best: { bonus: number; offer: TopUpOfferDto } | null = null;
    for (const o of offers) {
      const bonus = bonusOf(o, amount);
      if (bonus > 0 && (!best || bonus > best.bonus)) best = { bonus, offer: o };
    }
    return best;
  }

  // ---------- admin ----------
  list() {
    return this.prisma.topUpOffer.findMany({ orderBy: [{ active: 'desc' }, { minAmount: 'asc' }] }).then((x) => x.map(toOfferDto));
  }

  async save(input: { id?: string; title: string; minAmount: number; bonusPct: number; maxBonus?: number | null; firstOnly?: boolean; startsAt?: string | null; endsAt?: string | null; active?: boolean }) {
    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException('The end date must be after the start date');
    const data = {
      title: input.title.trim(),
      minAmount: input.minAmount,
      bonusPct: input.bonusPct,
      maxBonus: input.maxBonus ?? null,
      firstOnly: !!input.firstOnly,
      startsAt,
      endsAt,
      active: input.active ?? true,
    };
    if (input.id) {
      if (!(await this.prisma.topUpOffer.findUnique({ where: { id: input.id } }))) throw new NotFoundException('Offer not found');
      return toOfferDto(await this.prisma.topUpOffer.update({ where: { id: input.id }, data }));
    }
    return toOfferDto(await this.prisma.topUpOffer.create({ data }));
  }

  async remove(id: string) {
    await this.prisma.topUpOffer.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Offer not found');
    });
    return { ok: true };
  }

  /** Who added coins, how much, and the bonus they got. */
  async purchases(q: { page?: number; status?: string; q?: string }) {
    const pageSize = 30;
    const page = q.page ?? 1;
    const where: Prisma.PaymentWhereInput = {
      purpose: 'WALLET_TOPUP',
      ...(q.status === 'all' ? {} : q.status === 'unpaid' ? { status: { not: 'PAID' } } : { status: 'PAID' }),
      ...(q.q ? { user: { OR: [{ name: { contains: q.q } }, { phone: { contains: q.q } }, { contactEmail: { contains: q.q } }] } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { user: { select: { id: true, name: true, phone: true } } } }),
    ]);
    const items: CoinPurchaseDto[] = rows.map((p) => ({
      id: p.id,
      user: p.user,
      amount: p.amount,
      bonus: p.bonus,
      offerTitle: p.offerTitle,
      status: p.status,
      provider: p.provider,
      providerPaymentId: p.providerPaymentId,
      createdAt: p.createdAt.toISOString(),
    }));
    return { items, total, page, pageSize };
  }

  async summary(): Promise<CoinPurchaseSummaryDto> {
    const now = Date.now();
    const startOfToday = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + 'T00:00:00+05:30');
    const sum = async (since?: Date) => {
      const a = await this.prisma.payment.aggregate({
        where: { purpose: 'WALLET_TOPUP', status: 'PAID', ...(since ? { updatedAt: { gte: since } } : {}) },
        _count: true,
        _sum: { amount: true, bonus: true },
      });
      return { count: a._count, amount: a._sum.amount ?? 0, bonus: a._sum.bonus ?? 0 };
    };
    const [today, week, month, all, buyers] = await Promise.all([
      sum(startOfToday),
      sum(new Date(now - 7 * DAY)),
      sum(new Date(now - 30 * DAY)),
      sum(),
      this.prisma.payment.groupBy({ by: ['userId'], where: { purpose: 'WALLET_TOPUP', status: 'PAID' } }).then((g) => g.length),
    ]);
    return { today, week, month, allTime: { ...all, buyers } };
  }
}
