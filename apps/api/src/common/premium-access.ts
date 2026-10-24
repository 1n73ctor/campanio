import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** What a member has unlocked: every Premium host (an active 30-day pass or lifetime) and/or single hosts. */
export async function premiumAccess(prisma: PrismaService, userId?: string | null) {
  if (!userId) return { all: false, lifetime: false, until: null as Date | null, hosts: new Set<string>() };
  const rows = await prisma.premiumUnlock.findMany({ where: { userId }, select: { kind: true, hostUserId: true, expiresAt: true } });
  const now = Date.now();
  const lifetime = rows.some((r) => r.kind === 'LIFETIME');
  const passes = rows.filter((r) => r.kind === 'PASS_30' && r.expiresAt && r.expiresAt.getTime() > now).map((r) => r.expiresAt!);
  const until = passes.length ? new Date(Math.max(...passes.map((d) => d.getTime()))) : null;
  return { all: lifetime || !!until, lifetime, until, hosts: new Set(rows.filter((r) => r.kind === 'HOST' && r.hostUserId).map((r) => r.hostUserId!)) };
}

/** Can this person see (and book or chat with) this host? Non-Premium hosts: always. */
export async function canSeeHost(prisma: PrismaService, viewer: { id: string; role: string } | null | undefined, hostUserId: string) {
  const host = await prisma.companionProfile.findUnique({ where: { userId: hostUserId }, select: { premium: true } });
  if (!host?.premium) return true;
  if (!viewer) return false;
  if (viewer.id === hostUserId || viewer.role === 'ADMIN') return true;
  const a = await premiumAccess(prisma, viewer.id);
  return a.all || a.hosts.has(hostUserId);
}

export async function assertCanSeeHost(prisma: PrismaService, viewer: { id: string; role: string }, hostUserId: string) {
  if (!(await canSeeHost(prisma, viewer, hostUserId))) throw new ForbiddenException('This is a ⭐ Premium host — unlock their profile first');
}
