import { assertCanSeeHost } from '../common/premium-access';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ChatUnlock, Conversation, DirectMessage, User } from '@prisma/client';
import { formatINR, type AdminChatStatsDto, type AdminChatUnlockDto, type ChatPricesDto, type ChatUnlockKind, type ConversationDto, type DirectMessageDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { filterMessage } from '../common/content-filter';

const HOUR = 3600_000;
type ConvWith = Conversation & {
  user: User;
  host: User & { companion?: { id: string } | null };
  messages?: DirectMessage[];
  unlocks?: ChatUnlock[];
};

/** the host's cut of a chat payment, in whole coins (rounded down — the platform keeps the remainder) */
const share = (price: number, pct: number) => Math.floor((price * pct) / 100);

const toMessageDto = (m: DirectMessage): DirectMessageDto => ({ id: m.id, conversationId: m.conversationId, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString() });

/**
 * Paid chats: a member spends coins (wallet balance) to message a host, either for a set time or for good. Hosts reply
 * free. Every coin payment is logged (ChatUnlock + wallet ledger); if the host hasn't replied within the refund window,
 * the coins go back automatically. All kept coins are platform revenue.
 */
@Injectable()
export class ChatsService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Chats');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private wallet: WalletLedger,
    private notifications: NotificationsService,
    private rt: RealtimeService,
  ) {}

  onModuleInit() {
    if (process.env.DISABLE_JOBS === 'true') return;
    this.timer = setInterval(() => void this.refundUnanswered(), 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async prices(): Promise<ChatPricesDto> {
    const s = await this.settings.get();
    return { enabled: s.chatEnabled === 1, timedPrice: s.chatTimedPrice, timedHours: s.chatTimedHours, permanentPrice: s.chatPermanentPrice, refundHours: s.chatRefundHours };
  }

  private async assertEnabled() {
    if (!(await this.prices()).enabled) throw new ForbiddenException('Chats are not available right now');
  }

  private async assertNotBlocked(a: string, b: string) {
    const n = await this.prisma.block.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } });
    if (n) throw new ForbiddenException('You can’t message this person');
  }

  private canWrite(c: Conversation) {
    return c.permanent || (!!c.accessUntil && c.accessUntil.getTime() > Date.now());
  }

  private dto(c: ConvWith, viewerId: string): ConversationDto {
    const isHost = c.hostId === viewerId;
    const other = isHost ? c.user : c.host;
    const last = c.messages?.[0];
    const waiting = (c.unlocks ?? []).filter((u) => u.status === 'ACTIVE').sort((a, b) => b.refundDueAt.getTime() - a.refundDueAt.getTime())[0];
    const readAt = isHost ? c.hostReadAt : c.userReadAt;
    return {
      id: c.id,
      viewerRole: isHost ? 'host' : 'user',
      other: { id: other.id, name: other.name, avatarUrl: other.avatarUrl, companionId: isHost ? null : (c.host.companion?.id ?? null) },
      permanent: c.permanent,
      accessUntil: c.accessUntil?.toISOString() ?? null,
      canWrite: isHost || this.canWrite(c),
      hostReplied: !!c.hostRepliedAt,
      refundDueAt: waiting?.refundDueAt.toISOString() ?? null,
      earnOnReply: isHost ? (c.unlocks ?? []).filter((u) => u.status === 'ACTIVE').reduce((s, u) => s + share(u.price, u.hostSharePct), 0) : 0,
      lastMessage: last ? { body: last.body, senderId: last.senderId, createdAt: last.createdAt.toISOString() } : null,
      unread: !!last && last.senderId !== viewerId && (!readAt || readAt < last.createdAt),
      createdAt: c.createdAt.toISOString(),
    };
  }

  private include = {
    user: true,
    host: { include: { companion: { select: { id: true } } } },
    messages: { where: { hidden: false }, orderBy: { createdAt: 'desc' as const }, take: 1 },
    unlocks: { where: { status: 'ACTIVE' } },
  };

  private async load(id: string, viewer: User) {
    const c = await this.prisma.conversation.findUnique({ where: { id }, include: this.include });
    if (!c || (c.userId !== viewer.id && c.hostId !== viewer.id)) throw new NotFoundException('Chat not found');
    return c;
  }

  /** The viewer's chats, newest first (as a member and, for hosts, the ones members opened with them). */
  async list(viewer: User) {
    const rows = await this.prisma.conversation.findMany({
      where: { OR: [{ userId: viewer.id }, { hostId: viewer.id }], lastMessageAt: { not: null } },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: this.include,
    });
    // a member also sees chats they paid for but haven't written in yet
    const opened = await this.prisma.conversation.findMany({ where: { userId: viewer.id, lastMessageAt: null }, include: this.include, orderBy: { createdAt: 'desc' }, take: 20 });
    return [...opened, ...rows].map((c) => this.dto(c, viewer.id));
  }

  /** The chat between this member and host, if there is one (to show "Message" vs "Open chat" on a profile). */
  async withHost(viewer: User, companionId: string) {
    const p = await this.prisma.companionProfile.findUnique({ where: { id: companionId } });
    if (!p) throw new NotFoundException('Host not found');
    const c = await this.prisma.conversation.findUnique({ where: { userId_hostId: { userId: viewer.id, hostId: p.userId } }, include: this.include });
    return { prices: await this.prices(), conversation: c ? this.dto(c, viewer.id) : null };
  }

  async get(viewer: User, id: string, markRead = true) {
    const c = await this.load(id, viewer);
    const messages = await this.prisma.directMessage.findMany({ where: { conversationId: id, hidden: false }, orderBy: { createdAt: 'asc' }, take: 500 });
    if (markRead) await this.prisma.conversation.update({ where: { id }, data: c.hostId === viewer.id ? { hostReadAt: new Date() } : { userReadAt: new Date() } });
    return { conversation: this.dto(c, viewer.id), messages: messages.map(toMessageDto) };
  }

  /**
   * Spends coins to open (or extend) a chat with a host. TIMED adds the set hours to whatever time is left; PERMANENT
   * opens it for good. Paid in one transaction with the log entry; refunded automatically if the host doesn't reply.
   */
  async unlock(viewer: User, companionId: string, kind: ChatUnlockKind) {
    await this.assertEnabled();
    const p = await this.prisma.companionProfile.findUnique({ where: { id: companionId }, include: { user: true } });
    if (!p || p.user.status !== 'ACTIVE' || p.kycStatus !== 'APPROVED') throw new NotFoundException('This host isn’t available to message');
    if (p.userId === viewer.id) throw new BadRequestException('You can’t message yourself');
    if (viewer.role === 'ADMIN') throw new ForbiddenException('Admins can’t open member chats');
    await this.assertNotBlocked(viewer.id, p.userId);
    await assertCanSeeHost(this.prisma, viewer, p.userId);
    const s = await this.prices();
    const price = kind === 'PERMANENT' ? s.permanentPrice : s.timedPrice;

    const existing = await this.prisma.conversation.findUnique({ where: { userId_hostId: { userId: viewer.id, hostId: p.userId } } });
    if (existing?.permanent) throw new BadRequestException('This chat is already open for good');

    const result = await this.prisma.$transaction(async (tx) => {
      const c = existing ?? (await tx.conversation.create({ data: { userId: viewer.id, hostId: p.userId } }));
      const now = Date.now();
      const from = c.accessUntil && c.accessUntil.getTime() > now ? c.accessUntil.getTime() : now;
      const unlock = await tx.chatUnlock.create({
        data: {
          conversationId: c.id,
          userId: viewer.id,
          hostId: p.userId,
          kind,
          price,
          hours: kind === 'TIMED' ? s.timedHours : null,
          refundDueAt: new Date(now + s.refundHours * HOUR),
          // the share is fixed when the member pays, so changing the setting never changes what's owed
          hostSharePct: (await this.settings.get()).chatHostSharePct,
        },
      });
      let promoUsed: number;
      try {
        promoUsed = await this.wallet.spend(tx, viewer.id, price, `Chat with ${p.user.name ?? 'a host'} · ${kind === 'PERMANENT' ? 'open for good' : `${s.timedHours}h`}`, { type: 'chat-unlock', id: unlock.id });
      } catch (e) {
        if (e instanceof BadRequestException) throw new BadRequestException(`Not enough coins — this costs ${formatINR(price)}. Add coins in your wallet.`);
        throw e;
      }
      await tx.chatUnlock.update({ where: { id: unlock.id }, data: { promoUsed } });
      return tx.conversation.update({
        where: { id: c.id },
        data: kind === 'PERMANENT' ? { permanent: true } : { accessUntil: new Date(from + s.timedHours * HOUR) },
        include: this.include,
      });
    });
    this.log.log(`chat unlock ${kind} ${formatINR(price)} by ${viewer.id} → host ${p.userId}`);
    // admin sidebar counter + pop-up
    this.rt.toAdmins('chat:unlocked', { member: viewer.name, host: p.user.name, kind });
    return this.dto(result, viewer.id);
  }

  async send(viewer: User, id: string, body: string) {
    const c = await this.load(id, viewer);
    const isHost = c.hostId === viewer.id;
    if (!isHost) await this.assertEnabled();
    if (!isHost && !this.canWrite(c)) throw new ForbiddenException('Your chat time is over — open the chat again to keep writing');
    const other = isHost ? c.userId : c.hostId;
    await this.assertNotBlocked(viewer.id, other);
    const f = filterMessage(body);
    if (!f.body) throw new BadRequestException('Message is empty');

    const now = new Date();
    const { m, earned } = await this.prisma.$transaction(async (tx) => {
      const m = await tx.directMessage.create({ data: { conversationId: id, senderId: viewer.id, body: f.body, flagged: f.flagged, flagReason: f.reason } });
      await tx.conversation.update({
        where: { id },
        data: { lastMessageAt: now, ...(isHost ? { hostRepliedAt: now, hostReadAt: now } : { userReadAt: now }) },
      });
      // the host answered: each payment waiting on a reply is kept (no refund) and the host gets their share of it.
      // Claimed one by one, so a payment the refund job just returned can't also be paid to the host.
      let earned = 0;
      if (isHost) {
        const waiting = await tx.chatUnlock.findMany({ where: { conversationId: id, status: 'ACTIVE' } });
        for (const u of waiting) {
          const cut = share(u.price, u.hostSharePct);
          const claimed = await tx.chatUnlock.updateMany({ where: { id: u.id, status: 'ACTIVE' }, data: { status: 'ANSWERED', hostEarning: cut } });
          if (!claimed.count || cut <= 0) continue;
          await this.wallet.credit(tx, viewer.id, cut, `Chat earnings · ${c.user.name?.split(' ')[0] ?? 'a member'}`, { type: 'chat-earning', id: u.id });
          earned += cut;
        }
      }
      return { m, earned };
    });
    const dto = toMessageDto(m);
    this.rt.toUser(other, 'dm:new', dto);
    this.rt.toUser(viewer.id, 'dm:new', dto);
    if (f.reason?.includes('explicit')) this.rt.toAdmins('message:flagged', { ...dto, kind: 'direct' });

    // tell the host about a member's message (once per unread streak, so a burst of messages is one alert)
    if (!isHost) {
      const prevUnread = await this.prisma.directMessage.count({
        where: { conversationId: id, senderId: viewer.id, id: { not: m.id }, createdAt: { gt: c.hostReadAt ?? new Date(0) } },
      });
      if (!prevUnread)
        await this.notifications.notify(other, {
          type: 'chat.new',
          title: `New message from ${viewer.name?.split(' ')[0] ?? 'a member'} 💬`,
          body: `“${f.body.slice(0, 120)}” — reply within ${(await this.prices()).refundHours}h${c.unlocks?.some((u) => u.status === 'ACTIVE' && u.hostSharePct > 0) ? ' to earn coins' : ''}. Replies are free.`,
          link: `/messages/${id}`,
        });
    }
    if (earned > 0)
      await this.notifications.notify(viewer.id, {
        type: 'chat.earning',
        title: `You earned ${earned.toLocaleString('en-IN')} coins 💸`,
        body: `For replying to ${c.user.name?.split(' ')[0] ?? 'a member'}. It’s in your wallet and can be withdrawn.`,
        link: '/wallet',
      });
    return { message: dto, warning: f.flagged ? 'For your safety, contact details and off-platform payment info are hidden. Keep it platonic.' : null, earned };
  }

  /** Coins back for unlocks the host never answered in time (runs every minute). */
  async refundUnanswered() {
    const due = await this.prisma.chatUnlock.findMany({ where: { status: 'ACTIVE', refundDueAt: { lt: new Date() } }, include: { conversation: true }, take: 100 });
    for (const u of due) {
      try {
        const done = await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.chatUnlock.updateMany({ where: { id: u.id, status: 'ACTIVE' }, data: { status: 'REFUNDED', refundedAt: new Date() } });
          if (!claimed.count) return false;
          await this.wallet.credit(tx, u.userId, u.price, 'Chat refund · the host didn’t reply in time', { type: 'chat-refund', id: u.id }, u.promoUsed);
          // a refunded unlock no longer opens the chat
          const c = await tx.conversation.findUniqueOrThrow({ where: { id: u.conversationId } });
          if (u.kind === 'PERMANENT') await tx.conversation.update({ where: { id: c.id }, data: { permanent: false } });
          else if (u.hours && c.accessUntil) {
            const end = Math.max(Date.now(), c.accessUntil.getTime() - u.hours * HOUR);
            await tx.conversation.update({ where: { id: c.id }, data: { accessUntil: new Date(end) } });
          }
          return true;
        });
        if (!done) continue;
        await this.notifications.notify(u.userId, {
          type: 'wallet.refund',
          title: `${formatINR(u.price)} coins refunded`,
          body: 'The host didn’t reply in time, so your coins are back in your wallet.',
          link: '/wallet',
        });
      } catch (e) {
        this.log.error(`chat refund ${u.id} failed: ${(e as Error).message}`);
      }
    }
    if (due.length) this.log.log(`processed ${due.length} chat refund(s)`);
  }

  // ---------- admin ----------

  async adminStats(): Promise<AdminChatStatsDto> {
    const [kept, pending, refunded, unlocks, conversations] = await Promise.all([
      this.prisma.chatUnlock.aggregate({ where: { status: 'ANSWERED' }, _sum: { price: true, hostEarning: true } }),
      this.prisma.chatUnlock.aggregate({ where: { status: 'ACTIVE' }, _sum: { price: true } }),
      this.prisma.chatUnlock.aggregate({ where: { status: 'REFUNDED' }, _sum: { price: true } }),
      this.prisma.chatUnlock.count(),
      this.prisma.conversation.count(),
    ]);
    return { earned: (kept._sum.price ?? 0) - (kept._sum.hostEarning ?? 0), hostEarnings: kept._sum.hostEarning ?? 0, pending: pending._sum.price ?? 0, refunded: refunded._sum.price ?? 0, unlocks, conversations };
  }

  async adminUnlocks(page = 1, status?: string) {
    const pageSize = 25;
    const where = status ? { status } : {};
    const [total, rows] = await Promise.all([
      this.prisma.chatUnlock.count({ where }),
      this.prisma.chatUnlock.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { conversation: { include: { user: true, host: true } } } }),
    ]);
    const items: AdminChatUnlockDto[] = rows.map((u) => ({
      id: u.id,
      conversationId: u.conversationId,
      user: { id: u.userId, name: u.conversation.user.name },
      host: { id: u.hostId, name: u.conversation.host.name },
      kind: u.kind as ChatUnlockKind,
      price: u.price,
      hours: u.hours,
      promoUsed: u.promoUsed,
      hostSharePct: u.hostSharePct,
      hostEarning: u.hostEarning,
      status: u.status as AdminChatUnlockDto['status'],
      refundDueAt: u.refundDueAt.toISOString(),
      refundedAt: u.refundedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
    return { items, total, page, pageSize };
  }

  /** The whole conversation, for moderation (admins read; they never post). */
  async adminConversation(id: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id },
      include: { user: true, host: true, messages: { orderBy: { createdAt: 'asc' }, take: 1000 }, unlocks: { orderBy: { createdAt: 'asc' } } },
    });
    if (!c) throw new NotFoundException('Chat not found');
    return {
      id: c.id,
      user: { id: c.user.id, name: c.user.name },
      host: { id: c.host.id, name: c.host.name },
      permanent: c.permanent,
      accessUntil: c.accessUntil?.toISOString() ?? null,
      messages: c.messages.map((m) => ({ ...toMessageDto(m), flagged: m.flagged, flagReason: m.flagReason, hidden: m.hidden })),
      unlocks: c.unlocks.map((u) => ({ id: u.id, kind: u.kind, price: u.price, hours: u.hours, status: u.status, hostEarning: u.hostEarning, createdAt: u.createdAt.toISOString(), refundedAt: u.refundedAt?.toISOString() ?? null })),
    };
  }
}
