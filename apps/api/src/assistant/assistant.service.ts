import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import type { User } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { createHash, randomBytes } from 'crypto';
import { CATEGORIES, formatINR } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { WalletLedger } from '../common/wallet-ledger.service';
import { config } from '../common/config';
import { ASSISTANT_NAME, systemPrompt, type HostFacts } from './assistant.prompt';
import { instantAnswer } from './assistant.instant';
import { RealtimeService } from '../realtime/realtime.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationEmail } from '../mail/templates';

// cost controls: the model sees only the recent chat, writes short replies, and each person gets a daily allowance
const HISTORY = 8; // messages sent to the model per turn
const MAX_TOKENS = 300;
const PER_DAY = 25; // AI replies per person (or IP) per 24h — instant answers are free and don't count
const KNOWLEDGE_IN_PROMPT = 30;
/** account tools are only sent when the question is about the user's own account (they cost input tokens) */
const PERSONAL = /\b(my|mine|mera|meri|mere|refund|wallet|coin|balance|booking|meetup|payout|withdraw|verif|kyc|paise|paisa|payment|paid|charged|cancel|order|account)\b/i;
// Claude Haiku 4.5 list prices (USD per million tokens) — for the admin's cost estimate
const PRICE_IN = 1;
const PRICE_OUT = 5;
const PER_CONVERSATION = 80;
const PER_HUMAN_CONVERSATION = 300; // talking to the team costs nothing, so a longer chat is fine
const LIVE = ['waiting', 'answered'];
const KEEP_DAYS = 90;
const DAY = 86_400_000;
const IST = { timeZone: 'Asia/Kolkata' } as const;
const when = (d: Date) => d.toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const first = (n: string | null | undefined) => n?.trim().split(/\s+/)[0] ?? 'someone';

/** Read-only lookups the assistant can make about the signed-in user — never anyone else, never a change. */
const TOOLS: Anthropic.Tool[] = [
  { name: 'get_my_account', description: "The signed-in user's own account: name, email & whether verified, city, member since, and host status (verification status and reason, listed or not).", input_schema: { type: 'object', properties: {} } },
  { name: 'get_my_meetups', description: "The signed-in user's recent meetups (as member and as host): status, who with (first name), when, activity, amounts, cancellation/refund details, disputes.", input_schema: { type: 'object', properties: {} } },
  { name: 'get_my_wallet', description: "The signed-in user's wallet: balance, how much is spend-only credit/coins vs withdrawable, recent transactions, payouts, and coin top-ups waiting for approval.", input_schema: { type: 'object', properties: {} } },
  {
    name: 'handoff_to_human',
    description: 'Pass the conversation to a person on the Companio team. Use when the user asks for a human, or for money problems you cannot resolve, safety concerns, complaints, or anything you are unsure about.',
    input_schema: { type: 'object', properties: { summary: { type: 'string', description: 'One or two sentences for the team: who, what they need, what you already checked.' } }, required: ['summary'] },
  },
];

export interface AssistantReply {
  conversationKey: string;
  /** null while they're talking to the team: their message waits for a person */
  reply: string | null;
  handoff: boolean;
  summary: string | null;
  /** talking to the team (see AssistantConversation.humanStatus) */
  human: string | null;
}

type ChatLine = { role: string; content: string; authorName: string | null; createdAt: Date };
const toLine = (m: ChatLine) => ({ role: m.role, content: m.content, name: m.authorName, at: m.createdAt.toISOString() });

@Injectable()
export class AssistantService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Assistant');
  private client: Anthropic | null = null;
  private hostFacts: { at: number; facts: HostFacts } | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private wallet: WalletLedger,
    private rt: RealtimeService,
    private mail: MailService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (config.assistant.apiKey && config.assistant.apiKey !== 'mock') this.client = new Anthropic({ apiKey: config.assistant.apiKey });
    if (process.env.DISABLE_JOBS === 'true') return;
    // conversations are kept for 90 days, then deleted
    this.timer = setInterval(() => void this.prisma.assistantConversation.deleteMany({ where: { lastAt: { lt: new Date(Date.now() - KEEP_DAYS * DAY) } } }).catch(() => {}), 6 * 3600_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  get configured() {
    return !!config.assistant.apiKey;
  }

  async status() {
    const s = await this.settings.get();
    return { enabled: s.assistantEnabled === 1 && this.configured, name: ASSISTANT_NAME };
  }

  /** The conversation so far (to restore the chat window after a reload). */
  async history(key: string, viewer?: User) {
    const c = await this.prisma.assistantConversation.findUnique({ where: { key }, include: { messages: { orderBy: { createdAt: 'desc' }, take: 150 } } });
    c?.messages.reverse();
    if (!c || (c.userId && c.userId !== viewer?.id)) throw new NotFoundException('Conversation not found');
    return { handoff: c.handoff, human: c.humanStatus, contactEmail: c.contactEmail, rating: c.rating, messages: c.messages.map(toLine) };
  }

  async rate(key: string, rating: 1 | -1, viewer?: User) {
    const c = await this.prisma.assistantConversation.findUnique({ where: { key } });
    if (!c || (c.userId && c.userId !== viewer?.id)) throw new NotFoundException('Conversation not found');
    await this.prisma.assistantConversation.update({ where: { id: c.id }, data: { rating } });
    return { ok: true };
  }

  /** The user tapped "Talk to a person" (no AI call needed). Starts a conversation if they hadn't written yet. */
  async requestHuman(key: string | undefined, viewer?: User, ip?: string) {
    let c = key ? await this.prisma.assistantConversation.findUnique({ where: { key } }) : null;
    if (c && c.userId && c.userId !== viewer?.id) throw new NotFoundException('Conversation not found');
    if (!c) c = await this.prisma.assistantConversation.create({ data: { key: randomBytes(24).toString('base64url'), userId: viewer?.id ?? null, ipHash: this.ipHash(ip) } });
    const lastAsk = (await this.prisma.assistantMessage.findFirst({ where: { conversationId: c.id, role: 'user' }, orderBy: { createdAt: 'desc' } }))?.content;
    const summary = lastAsk ? `Asked for a person. Last message: “${lastAsk.slice(0, 200)}”` : 'Asked for a person.';
    await this.toTeam(c, c.summary && c.humanStatus ? c.summary : summary, viewer);
    return { conversationKey: c.key, summary, human: 'waiting' };
  }

  /** No one from the team was free: the visitor leaves an email, and the team's replies go there too. */
  async leaveEmail(key: string, email: string, viewer?: User) {
    const c = await this.prisma.assistantConversation.findUnique({ where: { key } });
    if (!c || (c.userId && c.userId !== viewer?.id)) throw new NotFoundException('Conversation not found');
    if (!c.humanStatus) throw new BadRequestException('Tap “Talk to a person” first');
    const e = email.trim().toLowerCase();
    if (e !== c.contactEmail)
      await this.prisma.$transaction([
        this.prisma.assistantConversation.update({ where: { id: c.id }, data: { contactEmail: e } }),
        this.prisma.assistantMessage.create({ data: { conversationId: c.id, role: 'note', content: `Thanks! We’ll reply to ${e} as soon as someone from the team is free.` } }),
      ]);
    this.rt.toAdmins('assistant:message', { id: c.id });
    return { contactEmail: e };
  }

  private ipHash(ip?: string) {
    return ip ? createHash('sha256').update(`assistant:${ip}`).digest('hex').slice(0, 32) : null;
  }

  /**
   * Hands the conversation to the team: from now on the user's messages wait for a person in Admin → Assistant
   * instead of going to the AI. Admins get a live alert, and an email when it's a new request.
   */
  private async toTeam(c: { id: string; humanStatus: string | null }, summary: string, viewer?: User) {
    const isNew = !c.humanStatus || !LIVE.includes(c.humanStatus);
    await this.prisma.assistantConversation.update({ where: { id: c.id }, data: { handoff: true, humanStatus: 'waiting', summary, lastAt: new Date() } });
    if (!isNew) return;
    await this.prisma.assistantMessage.create({ data: { conversationId: c.id, role: 'note', content: 'You’re now chatting with the Companio team.' } });
    const who = viewer?.name?.trim() || (viewer ? 'A member' : 'A visitor');
    this.rt.toAdmins('assistant:waiting', { id: c.id, who, summary });
    void this.mail.toAdmins(`${who} wants to talk to the team`, `${summary}\n\nReply in Admin → Assistant — it appears in their chat window.`, `/admin/assistant?chat=${c.id}`);
  }

  async chat(input: { key?: string; message: string; ip?: string }, viewer?: User): Promise<AssistantReply> {
    const s = await this.settings.get();
    if (s.assistantEnabled !== 1 || !this.configured) throw new ServiceUnavailableException('The assistant is not available right now');
    const message = input.message.trim();
    if (!message) throw new BadRequestException('Type a message');
    const ipHash = this.ipHash(input.ip);

    // continue the visitor's conversation, or start a new one
    let c = input.key ? await this.prisma.assistantConversation.findUnique({ where: { key: input.key } }) : null;
    if (c && c.userId && c.userId !== viewer?.id) c = null; // someone else's — start fresh
    if (!c) c = await this.prisma.assistantConversation.create({ data: { key: randomBytes(24).toString('base64url'), userId: viewer?.id ?? null, ipHash } });
    else if (!c.userId && viewer) c = await this.prisma.assistantConversation.update({ where: { id: c.id }, data: { userId: viewer.id } });

    // talking to the team: the message waits for a person (no AI, no daily allowance)
    if (c.humanStatus && LIVE.includes(c.humanStatus)) {
      if ((await this.prisma.assistantMessage.count({ where: { conversationId: c.id } })) >= PER_HUMAN_CONVERSATION)
        throw new HttpException('This chat is very long — tap “New” to start another one.', HttpStatus.TOO_MANY_REQUESTS);
      await this.prisma.$transaction([
        this.prisma.assistantMessage.create({ data: { conversationId: c.id, role: 'user', content: message.slice(0, 1000) } }),
        this.prisma.assistantConversation.update({ where: { id: c.id }, data: { humanStatus: 'waiting', lastAt: new Date() } }),
      ]);
      this.rt.toAdmins('assistant:message', { id: c.id, who: viewer?.name?.trim() || (viewer ? 'A member' : 'A visitor'), text: message.slice(0, 140) });
      return { conversationKey: c.key, reply: null, handoff: false, summary: null, human: 'waiting' };
    }

    // cost limits
    const since = new Date(Date.now() - DAY);
    const today = await this.prisma.assistantMessage.count({
      where: { role: 'assistant', source: 'ai', createdAt: { gt: since }, conversation: viewer ? { userId: viewer.id } : { ipHash: ipHash ?? '-' } },
    });
    if ((await this.prisma.assistantMessage.count({ where: { conversationId: c.id } })) >= PER_CONVERSATION)
      throw new HttpException('This chat is very long — start a new one, or tap "Talk to a person".', HttpStatus.TOO_MANY_REQUESTS);

    await this.prisma.assistantMessage.create({ data: { conversationId: c.id, role: 'user', content: message.slice(0, 1000) } });

    // free answers first: greetings, starter questions, and questions an admin already answered
    const knowledge = await this.prisma.assistantKnowledge.findMany({ where: { active: true }, orderBy: { updatedAt: 'desc' }, take: 200, select: { question: true, answer: true } });
    const instant = await instantAnswer(message, {
      settings: s,
      firstName: viewer?.name?.split(' ')[0] ?? null,
      knowledge,
      coins: viewer ? async () => {
        const b = await this.wallet.balances(viewer.id);
        return `You have ${b.balance.toLocaleString('en-IN')} coins (${formatINR(b.balance)}) in your wallet${b.promoBalance ? ` — ${formatINR(b.promoBalance)} of it is spend-only credit/coins` : ''}. You can add more from Wallet → Add coins.`;
      } : undefined,
      nextMeetup: viewer ? async () => {
        const b = await this.prisma.booking.findFirst({ where: { userId: viewer.id, status: { in: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'] } }, orderBy: { startAt: 'asc' }, include: { companion: true } });
        if (!b) return 'You don’t have any upcoming meetups right now. Want help finding a host?';
        const label = b.status === 'ACCEPTED' ? 'confirmed ✅' : b.status === 'IN_PROGRESS' ? 'happening now' : `waiting for ${first(b.companion.name)} to accept`;
        return `Your meetup with ${first(b.companion.name)} on ${when(b.startAt)} is ${label}.${b.status === 'REQUESTED' ? ` If they don’t respond within ${s.requestExpiryHours}h, you get a full refund automatically.` : ''}`;
      } : undefined,
    });
    if (instant) {
      await this.prisma.$transaction([
        this.prisma.assistantMessage.create({ data: { conversationId: c.id, role: 'assistant', content: instant, source: 'instant' } }),
        this.prisma.assistantConversation.update({ where: { id: c.id }, data: { lastAt: new Date() } }),
      ]);
      return { conversationKey: c.key, reply: instant, handoff: false, summary: null, human: c.humanStatus };
    }
    if (today >= PER_DAY) throw new HttpException(`You've reached today's limit for the assistant — tap "Talk to a person" and the team will help.`, HttpStatus.TOO_MANY_REQUESTS);

    const past = await this.prisma.assistantMessage.findMany({ where: { conversationId: c.id, role: { not: 'note' } }, orderBy: { createdAt: 'desc' }, take: HISTORY });
    // the team's replies count as the assistant's side of the chat
    const messages: Anthropic.MessageParam[] = past.reverse().map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    while (messages.length && messages[0].role !== 'user') messages.shift(); // the model needs to start with the user

    const lookups = !!viewer && PERSONAL.test(message);
    const system = systemPrompt(s, knowledge.slice(0, KNOWLEDGE_IN_PROMPT), viewer ? (lookups ? 'tools' : 'signed-in') : 'signed-out', await this.facts());
    let handoff: string | null = null;
    let reply = '';
    const usage = { in: 0, out: 0 };
    try {
      reply = await this.run(system, messages, lookups ? viewer : undefined, !!viewer, (summary) => (handoff = summary), usage);
    } catch (e) {
      this.log.error(`assistant failed: ${(e as Error).message}`);
      reply = 'Sorry — I’m having trouble answering right now. Tap “Talk to a person” and someone from the team will help you.';
    }
    reply = reply.trim() || 'Sorry, could you say that another way?';
    await this.prisma.$transaction([
      this.prisma.assistantMessage.create({ data: { conversationId: c.id, role: 'assistant', content: reply, source: 'ai', inputTokens: usage.in, outputTokens: usage.out } }),
      this.prisma.assistantConversation.update({ where: { id: c.id }, data: { lastAt: new Date() } }),
    ]);
    if (handoff) await this.toTeam(c, handoff, viewer);
    return { conversationKey: c.key, reply, handoff: !!handoff, summary: handoff, human: handoff ? 'waiting' : c.humanStatus };
  }

  /** Live host numbers for the prompt (count, rate range, cities), cached for 10 minutes. */
  private async facts(): Promise<HostFacts> {
    if (this.hostFacts && Date.now() - this.hostFacts.at < 10 * 60_000) return this.hostFacts.facts;
    const rows = await this.prisma.companionProfile.findMany({ where: { isListed: true, kycStatus: 'APPROVED', user: { status: 'ACTIVE' } }, select: { hourlyRate: true, city: true } });
    const rates = rows.map((r) => r.hourlyRate).sort((a, b) => a - b);
    const cities = [...new Set(rows.map((r) => r.city))].sort();
    const facts: HostFacts =
      rows.length >= 3 ? { count: rows.length, min: rates[0], max: rates[rates.length - 1], median: rates[Math.floor(rates.length / 2)], cities } : { count: 0, min: 0, max: 0, median: 0, cities };
    this.hostFacts = { at: Date.now(), facts };
    return facts;
  }

  /**
   * The model, with up to 3 rounds of tool use. `toolsFor` is set only when the question is about the user's own
   * account — otherwise just the hand-over tool is sent (fewer tokens per message).
   */
  private async run(system: string, messages: Anthropic.MessageParam[], toolsFor: User | undefined, signedIn: boolean, onHandoff: (s: string) => void, usage: { in: number; out: number }) {
    const viewer = toolsFor;
    if (config.assistant.apiKey === 'mock') return this.mock(messages, toolsFor, onHandoff);
    const tools = viewer ? TOOLS : TOOLS.filter((t) => t.name === 'handoff_to_human');
    for (let round = 0; round < 3; round++) {
      const res = await this.client!.messages.create({
        model: config.assistant.model,
        max_tokens: MAX_TOKENS,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools,
        messages,
      });
      usage.in += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      usage.out += res.usage.output_tokens;
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
      const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !calls.length) return text;
      messages.push({ role: 'assistant', content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of calls) results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(await this.tool(call.name, call.input as Record<string, unknown>, viewer, onHandoff)) });
      messages.push({ role: 'user', content: results });
    }
    return 'Let me get someone from the team to help with this.';
  }

  /** Read-only lookups, always for the signed-in user only. */
  private async tool(name: string, input: Record<string, unknown>, viewer: User | undefined, onHandoff: (s: string) => void): Promise<unknown> {
    if (name === 'handoff_to_human') {
      onHandoff(String(input.summary ?? 'The user asked for a person.').slice(0, 500));
      return { ok: true, note: 'A team member will reply in this chat.' };
    }
    if (!viewer) return { error: 'Not signed in' };
    if (name === 'get_my_account') {
      const u = await this.prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, include: { companion: true, kycSubmissions: { orderBy: { createdAt: 'desc' }, take: 1 } } });
      return {
        name: u.name,
        email: u.contactEmail,
        emailVerified: !!u.contactEmailVerifiedAt,
        city: u.city,
        memberSince: when(u.createdAt),
        isHost: !!u.companion,
        host: u.companion && { verification: u.companion.kycStatus, listed: u.companion.isListed, hourlyRate: u.companion.hourlyRate, lastVerificationNote: u.kycSubmissions[0]?.reviewNote ?? null },
      };
    }
    if (name === 'get_my_meetups') {
      const rows = await this.prisma.booking.findMany({
        where: { OR: [{ userId: viewer.id }, { companionUserId: viewer.id }], status: { not: 'PENDING_PAYMENT' } },
        orderBy: { startAt: 'desc' },
        take: 10,
        include: { user: true, companion: true, dispute: true },
      });
      return rows.map((b) => ({
        role: b.userId === viewer.id ? 'member' : 'host',
        with: first(b.userId === viewer.id ? b.companion.name : b.user.name),
        activity: CATEGORIES.find((c) => c.slug === b.category)?.name ?? b.category,
        when: when(b.startAt),
        hours: b.hours,
        status: b.status,
        total: b.userId === viewer.id ? formatINR(b.total) : undefined,
        hostEarns: b.companionUserId === viewer.id ? formatINR(b.companionPayout) : undefined,
        cancelled: b.cancelledAt ? { by: b.cancelledBy, reason: b.cancelReason, at: when(b.cancelledAt) } : undefined,
        dispute: b.dispute ? { status: b.dispute.status, reason: b.dispute.reason } : undefined,
      }));
    }
    if (name === 'get_my_wallet') {
      const w = await this.prisma.wallet.findUnique({ where: { userId: viewer.id }, include: { txns: { orderBy: { createdAt: 'desc' }, take: 10 } } });
      const b = await this.wallet.balances(viewer.id);
      const payouts = await this.prisma.payout.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: 'desc' }, take: 5 });
      return {
        balance: formatINR(b.balance),
        spendOnlyCreditAndCoins: formatINR(b.promoBalance),
        withdrawable: formatINR(b.withdrawable),
        recent: (w?.txns ?? []).map((t) => ({ when: when(t.createdAt), type: t.type, amount: formatINR(t.amount), reason: t.reason })),
        payouts: payouts.map((p) => ({ amount: formatINR(p.amount), status: p.status, requested: when(p.createdAt), note: p.note })),
      };
    }
    return { error: 'Unknown tool' };
  }

  /** ANTHROPIC_API_KEY=mock: predictable answers for tests (no AI calls). */
  private async mock(messages: Anthropic.MessageParam[], viewer: User | undefined, onHandoff: (s: string) => void) {
    const last = String(messages[messages.length - 1].content).toLowerCase();
    if (/bot|real/.test(last)) return `I’m ${ASSISTANT_NAME}, Companio’s AI assistant — happy to connect you with a person from the team anytime.`;
    if (/human|person|agent|insaan/.test(last)) {
      onHandoff('User asked for a person.');
      return 'Sure — I’ve asked someone from the team to join. They’ll reply right here.';
    }
    if (/wallet|balance|coins/.test(last) && viewer) {
      const w = (await this.tool('get_my_wallet', {}, viewer, onHandoff)) as { balance: string };
      return `Your wallet balance is ${w.balance}.`;
    }
    if (/meetup|booking|refund/.test(last) && viewer) {
      const m = (await this.tool('get_my_meetups', {}, viewer, onHandoff)) as unknown[];
      return `You have ${m.length} recent meetup(s).`;
    }
    return `Hi! I’m ${ASSISTANT_NAME}, Companio’s assistant. How can I help?`;
  }

  // ---------- admin ----------

  async adminConversations(q: { page?: number; filter?: string }) {
    const pageSize = 25;
    const page = q.page ?? 1;
    const where =
      q.filter === 'waiting' ? { humanStatus: 'waiting' } : q.filter === 'team' ? { humanStatus: { in: LIVE } } : q.filter === 'handoff' ? { handoff: true } : q.filter === 'disliked' ? { rating: -1 } : q.filter === 'liked' ? { rating: 1 } : {};
    const [total, rows] = await Promise.all([
      this.prisma.assistantConversation.count({ where }),
      this.prisma.assistantConversation.findMany({
        where,
        orderBy: { lastAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, name: true } }, messages: { where: { role: 'user' }, orderBy: { createdAt: 'asc' }, take: 1 }, _count: { select: { messages: true } } },
      }),
    ]);
    return {
      items: rows.map((c) => ({
        id: c.id,
        user: c.user,
        firstQuestion: c.messages[0]?.content ?? '',
        messages: c._count.messages,
        handoff: c.handoff,
        human: c.humanStatus,
        contactEmail: c.contactEmail,
        summary: c.summary,
        rating: c.rating,
        lastAt: c.lastAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async adminConversation(id: string) {
    const c = await this.prisma.assistantConversation.findUnique({ where: { id }, include: { user: { select: { id: true, name: true } }, messages: { orderBy: { createdAt: 'asc' } } } });
    if (!c) throw new NotFoundException('Conversation not found');
    return { id: c.id, user: c.user, handoff: c.handoff, human: c.humanStatus, contactEmail: c.contactEmail, summary: c.summary, rating: c.rating, messages: c.messages.map((m) => ({ id: m.id, ...toLine(m) })) };
  }

  /** A team member's reply: shows up in the user's chat window within seconds (it checks for replies while open). */
  async adminReply(admin: User, id: string, text: string) {
    const c = await this.prisma.assistantConversation.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Conversation not found');
    const name = admin.name?.trim().split(/\s+/)[0] || 'Companio team';
    await this.prisma.$transaction([
      ...(c.humanStatus && LIVE.includes(c.humanStatus) ? [] : [this.prisma.assistantMessage.create({ data: { conversationId: c.id, role: 'note', content: 'You’re now chatting with the Companio team.' } })]),
      this.prisma.assistantMessage.create({ data: { conversationId: c.id, role: 'agent', content: text.trim(), authorName: name } }),
      this.prisma.assistantConversation.update({ where: { id: c.id }, data: { handoff: true, humanStatus: 'answered', lastAt: new Date() } }),
    ]);
    this.rt.toAdmins('assistant:message', { id: c.id });
    // signed-in members get it straight away in their chat bubble (whichever device they're on)
    if (c.userId) this.rt.toUser(c.userId, 'assistant:team', { key: c.key, name, text: text.trim().slice(0, 140) });
    // they left an email because no one was free: send the reply there too, so it reaches them even if they've left
    if (c.contactEmail) {
      const u = c.userId ? await this.prisma.user.findUnique({ where: { id: c.userId }, select: { name: true } }) : null;
      void this.mail.send(
        c.contactEmail,
        notificationEmail({
          firstName: u?.name?.trim().split(/\s+/)[0] || 'there',
          title: `${name} from the Companio team replied`,
          body: `${text.trim()}\n\nYou can reply by email, or open the chat bubble on our website to continue.`,
          button: { url: config.webUrl, label: 'Open Companio' },
          siteUrl: config.webUrl,
        }),
      );
    }
    return this.adminConversation(id);
  }

  /**
   * Admin → Users → "Message in chat bubble": a message from the team into this member's chat bubble. Continues their
   * latest chat (or starts one); they see it live if they're on the site, and get a notification that opens the chat.
   */
  async adminMessageUser(admin: User, userId: string, text: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u || u.status === 'DELETED') throw new NotFoundException('User not found');
    if (u.role === 'ADMIN') throw new BadRequestException('That’s an admin account');
    let c = await this.prisma.assistantConversation.findFirst({ where: { userId }, orderBy: { lastAt: 'desc' } });
    if (!c) c = await this.prisma.assistantConversation.create({ data: { key: randomBytes(24).toString('base64url'), userId, handoff: true, summary: 'Message from the team' } });
    const t = await this.adminReply(admin, c.id, text);
    await this.notifications.notify(userId, {
      type: 'admin.chat',
      title: 'New message from the Companio team 💬',
      body: text.trim().slice(0, 140),
      link: '/?chat=open',
    });
    return t;
  }

  /** A signed-in member's latest chat (so the bubble on any of their devices finds the team's messages). */
  async mine(viewer?: User) {
    if (!viewer) return null;
    const c = await this.prisma.assistantConversation.findFirst({ where: { userId: viewer.id }, orderBy: { lastAt: 'desc' } });
    return c ? { key: c.key, human: c.humanStatus } : null;
  }

  /** The team is done: the chat goes back to the AI (the user sees a note). */
  async adminClose(id: string) {
    const c = await this.prisma.assistantConversation.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Conversation not found');
    if (c.humanStatus && LIVE.includes(c.humanStatus))
      await this.prisma.$transaction([
        this.prisma.assistantMessage.create({ data: { conversationId: c.id, role: 'note', content: 'The team closed this chat. Riya (AI) will answer from here — tap “Talk to a person” any time.' } }),
        this.prisma.assistantConversation.update({ where: { id: c.id }, data: { humanStatus: 'closed' } }),
      ]);
    this.rt.toAdmins('assistant:message', { id: c.id });
    return this.adminConversation(id);
  }

  /** For the admin sidebar badge. */
  waitingCount() {
    return this.prisma.assistantConversation.count({ where: { humanStatus: 'waiting' } });
  }

  async adminStats() {
    const since = new Date(Date.now() - 7 * DAY);
    const [ai, instant] = await Promise.all([
      this.prisma.assistantMessage.aggregate({ where: { createdAt: { gt: since }, source: 'ai' }, _count: true, _sum: { inputTokens: true, outputTokens: true } }),
      this.prisma.assistantMessage.count({ where: { createdAt: { gt: since }, source: 'instant' } }),
    ]);
    const tokensIn = ai._sum.inputTokens ?? 0;
    const tokensOut = ai._sum.outputTokens ?? 0;
    const [conversations, handoffs, liked, disliked, knowledge] = await Promise.all([
      this.prisma.assistantConversation.count({ where: { createdAt: { gt: since } } }),
      this.prisma.assistantConversation.count({ where: { createdAt: { gt: since }, handoff: true } }),
      this.prisma.assistantConversation.count({ where: { createdAt: { gt: since }, rating: 1 } }),
      this.prisma.assistantConversation.count({ where: { createdAt: { gt: since }, rating: -1 } }),
      this.prisma.assistantKnowledge.count({ where: { active: true } }),
    ]);
    return {
      configured: this.configured,
      waiting: await this.waitingCount(),
      model: config.assistant.model,
      last7Days: { conversations, handoffs, liked, disliked, aiReplies: ai._count, freeReplies: instant, tokensIn, tokensOut, costUsd: Math.round(((tokensIn * PRICE_IN + tokensOut * PRICE_OUT) / 1e6) * 100) / 100 },
      knowledge,
    };
  }

  knowledgeList() {
    return this.prisma.assistantKnowledge.findMany({ orderBy: { updatedAt: 'desc' } });
  }
  knowledgeSave(admin: User, input: { id?: string; question: string; answer: string; active?: boolean }) {
    const data = { question: input.question.trim(), answer: input.answer.trim(), active: input.active ?? true };
    return input.id ? this.prisma.assistantKnowledge.update({ where: { id: input.id }, data }) : this.prisma.assistantKnowledge.create({ data: { ...data, createdBy: admin.id } });
  }
  async knowledgeDelete(id: string) {
    await this.prisma.assistantKnowledge.delete({ where: { id } });
    return { ok: true };
  }
}
