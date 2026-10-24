import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { AuditService } from '../common/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompanionsService } from '../companions/companions.service';
import { PaymentsService, grantPremium, type PremiumKind } from '../payments/payments.service';
import { canSeeHost, premiumAccess } from '../common/premium-access';
import { ensureBlurred } from '../files/uploads';

/**
 * ⭐ Premium hosts: an admin marks a host Premium; members see a blurred card until they unlock that host (₹99), all
 * Premium hosts for 30 days (₹499) or for good (₹999) — prices set in Admin → Settings. Paid only with real money
 * (gateway, or coins they bought). All of it is platform revenue.
 */
@Injectable()
export class PremiumService implements OnModuleInit {
  private log = new Logger('Premium');
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private wallet: WalletLedger,
    private audit: AuditService,
    private notifications: NotificationsService,
    private companions: CompanionsService,
    private payments: PaymentsService,
  ) {}

  /** make sure every Premium host has blurred copies of their photos */
  async onModuleInit() {
    const hosts = await this.prisma.companionProfile.findMany({ where: { premium: true }, include: { user: { select: { avatarUrl: true } } } }).catch(() => []);
    for (const h of hosts) await this.blurAll(h.user.avatarUrl, h.photos);
  }

  async blurAll(avatarUrl: string | null, photosJson: string) {
    await ensureBlurred(avatarUrl);
    for (const p of JSON.parse(photosJson || '[]') as string[]) await ensureBlurred(p);
  }

  private async prices() {
    const s = await this.settings.get();
    return { HOST: s.premiumHostPrice, PASS_30: s.premiumPassPrice, LIFETIME: s.premiumLifetimePrice } as Record<PremiumKind, number>;
  }

  /** Prices, what this member has unlocked, and the bought coins they could pay with. */
  async offer(viewer?: User) {
    const [prices, a, w] = await Promise.all([
      this.prices(),
      premiumAccess(this.prisma, viewer?.id),
      viewer ? this.prisma.wallet.findUnique({ where: { userId: viewer.id }, select: { paidCoins: true } }) : null,
    ]);
    return { prices, access: { all: a.all, lifetime: a.lifetime, until: a.until?.toISOString() ?? null, hosts: [...a.hosts] }, paidCoins: w?.paidCoins ?? 0 };
  }

  /** The full profile of a Premium host — only for members who unlocked it. */
  async fullHost(viewer: User, profileId: string) {
    const c = await this.prisma.companionProfile.findUnique({ where: { id: profileId }, select: { userId: true } });
    if (!c) throw new NotFoundException('Host not found');
    if (!(await canSeeHost(this.prisma, viewer, c.userId))) throw new ForbiddenException('Unlock this ⭐ Premium host to see their profile');
    return this.companions.detail(profileId, true);
  }

  /** Real photos of the Premium hosts this member can see (to show on Explore cards). */
  async unlocked(viewer: User) {
    const a = await premiumAccess(this.prisma, viewer.id);
    const hosts = await this.prisma.companionProfile.findMany({
      where: { premium: true, ...(a.all ? {} : { userId: { in: [...a.hosts] } }) },
      select: { id: true, userId: true, user: { select: { avatarUrl: true } } },
    });
    return hosts.map((h) => ({ id: h.id, userId: h.userId, avatarUrl: h.user.avatarUrl }));
  }

  async unlock(viewer: User, kind: PremiumKind, profileId: string | undefined, payWith: 'coins' | 'gateway') {
    if (viewer.role === 'ADMIN') throw new ForbiddenException('Admins can see every profile already');
    let hostUserId: string | null = null;
    const a = await premiumAccess(this.prisma, viewer.id);
    if (kind === 'HOST') {
      const c = profileId ? await this.prisma.companionProfile.findUnique({ where: { id: profileId }, select: { userId: true, premium: true } }) : null;
      if (!c?.premium) throw new BadRequestException('This isn’t a Premium host');
      if (c.userId === viewer.id) throw new BadRequestException('That’s your own profile');
      hostUserId = c.userId;
      if (a.all || a.hosts.has(hostUserId)) throw new BadRequestException('You’ve already unlocked this host');
    }
    if (kind === 'LIFETIME' && a.lifetime) throw new BadRequestException('You already have lifetime access');
    if (kind === 'PASS_30' && a.lifetime) throw new BadRequestException('You already have lifetime access');
    const price = (await this.prices())[kind];

    if (payWith === 'gateway') return this.payments.checkoutPremium(viewer, kind, hostUserId, price);
    await this.prisma.$transaction(async (tx) => {
      const u = await grantPremium(tx, { userId: viewer.id, kind, hostUserId, price, paidWith: 'COINS' });
      await this.wallet.spendPaidCoins(tx, viewer.id, price, kind === 'HOST' ? 'Unlocked a ⭐ Premium host' : kind === 'PASS_30' ? '⭐ Premium pass (30 days)' : '⭐ Premium lifetime access', { type: 'premium', id: u.id });
    });
    return { status: 'PAID' as const };
  }

  // ---------- admin ----------

  async setPremium(admin: User, userId: string, on: boolean) {
    const c = await this.prisma.companionProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!c) throw new BadRequestException('This person isn’t a host');
    if (on && c.kycStatus !== 'APPROVED') throw new BadRequestException('Only verified hosts can be Premium');
    if (on) await this.blurAll(c.user.avatarUrl, c.photos);
    await this.prisma.companionProfile.update({ where: { userId }, data: { premium: on, premiumSince: on ? (c.premiumSince ?? new Date()) : null } });
    await this.audit.log(admin.id, on ? 'host.premium_on' : 'host.premium_off', 'user', userId, {});
    if (on && !c.premium)
      await this.notifications.notify(userId, {
        type: 'host.premium',
        title: 'You’re now a ⭐ Premium host',
        body: 'Your profile now carries the Premium badge. Members unlock your full profile before they can book or message you.',
        link: '/companion/dashboard',
      });
    return { premium: on };
  }

  async adminList(q: { page?: number }) {
    const page = q.page ?? 1;
    const pageSize = 30;
    const [total, rows, agg, byKind, premiumHosts] = await Promise.all([
      this.prisma.premiumUnlock.count(),
      this.prisma.premiumUnlock.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.premiumUnlock.aggregate({ _sum: { price: true }, _count: true }),
      this.prisma.premiumUnlock.groupBy({ by: ['kind'], _count: true, _sum: { price: true } }),
      this.prisma.companionProfile.findMany({
        where: { premium: true },
        orderBy: { premiumSince: 'desc' },
        select: { userId: true, premiumSince: true, user: { select: { name: true, phone: true } } },
      }),
    ]);
    const unlocksByHost = new Map(
      (await this.prisma.premiumUnlock.groupBy({ by: ['hostUserId'], where: { hostUserId: { in: premiumHosts.map((h) => h.userId) } }, _count: true })).map((g) => [g.hostUserId, g._count]),
    );
    const ids = [...new Set(rows.flatMap((r) => [r.userId, r.hostUserId]).filter((x): x is string => !!x))];
    const users = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true } })).map((u) => [u.id, u]));
    return {
      summary: { unlocks: agg._count, revenue: agg._sum.price ?? 0, premiumHosts: premiumHosts.length, byKind: Object.fromEntries(byKind.map((k) => [k.kind, { count: k._count, revenue: k._sum.price ?? 0 }])) },
      hosts: premiumHosts.map((h) => ({ userId: h.userId, name: h.user.name, phone: h.user.phone, since: h.premiumSince?.toISOString() ?? null, unlocks: unlocksByHost.get(h.userId) ?? 0 })),
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        price: r.price,
        paidWith: r.paidWith,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        member: users.get(r.userId) ?? { id: r.userId, name: null, phone: null },
        host: r.hostUserId ? (users.get(r.hostUserId) ?? { id: r.hostUserId, name: null, phone: null }) : null,
      })),
      total,
      page,
      pageSize,
    };
  }
}
