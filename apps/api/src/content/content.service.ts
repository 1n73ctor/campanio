import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { BlogPost, CityGuide as CityGuideRow, User } from '@prisma/client';
import { CATEGORIES, CITY_GUIDES, POSTS, cityBySlug, type Block, type BlogPostDto, type CityGuideDto } from '@companio/types';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { AuditService } from '../common/audit.service';
import { MailService } from '../mail/mail.service';
import { config } from '../common/config';

const MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-5-5', 'claude-opus-5-5'];
const TONES = ['pink', 'lime', 'sky', 'sunny', 'lavender'];
const LAST_RUN = 'blog.lastDraftWeek';
const HOUR = 3600_000;

export type PostInput = { title: string; excerpt: string; emoji?: string; tone?: string; body: Block[]; slug?: string };
export type GuideInput = { intro: string[]; faqs: { q: string; a: string }[]; spots: Record<string, string> };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '');

/** The Monday-based week an India-time date falls in, e.g. "2026-W44". */
function istWeek(d = new Date()) {
  const ist = new Date(d.getTime() + 330 * 60_000);
  const day = (ist.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

const BRAND = `You write for Companio (getcompanio.in), an Indian platform where members book ID-verified local hosts for platonic activities: gym partner, movie buddy, city guide, coffee chat, shopping, travel, food walks, festivals, sports, photo walks, comedy shows, career chats, settling into a new city, and company for seniors.
Rules you must follow:
- Strictly platonic. Never romantic, dating or sexual language or hints. Never call hosts "escorts" or "dates".
- Safety-first: public places, ID-verified hosts, escrow payments, live-location sharing, SOS. Mention safety naturally, once.
- Only name well-known, long-standing public places (landmarks, big parks, famous markets, well-known areas). Never invent cafés, businesses, prices, statistics, quotes, reviews or people.
- Never promise earnings, guaranteed outcomes or anything Companio doesn't do.
- Friendly, practical, specific, Indian English. Short paragraphs. No fluff, no clichés, no emojis in the text.`;

@Injectable()
export class ContentService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Content');
  private client: Anthropic | null = null;
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private audit: AuditService,
    private mail: MailService,
  ) {}

  onModuleInit() {
    if (config.assistant.apiKey && config.assistant.apiKey !== 'mock') this.client = new Anthropic({ apiKey: config.assistant.apiKey });
    if (process.env.DISABLE_JOBS === 'true' || !this.client) return;
    this.timer = setInterval(() => void this.tick().catch((e) => this.log.warn(String(e))), HOUR);
    setTimeout(() => void this.tick().catch((e) => this.log.warn(String(e))), 5 * 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------- public ----------

  async publishedPosts() {
    const rows = await this.prisma.blogPost.findMany({ where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' } });
    return rows.map(toPostDto);
  }

  async publishedGuides() {
    const rows = await this.prisma.cityGuide.findMany({ where: { status: 'PUBLISHED' } });
    return rows.map(toGuideDto);
  }

  // ---------- admin: posts ----------

  async listPosts(status?: string) {
    const rows = await this.prisma.blogPost.findMany({ where: status ? { status } : {}, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] });
    return { items: rows.map(toPostDto), builtIn: POSTS.map((p) => ({ slug: p.slug, title: p.title, date: p.date })) };
  }

  async createPost(admin: User, input: PostInput) {
    const p = await this.prisma.blogPost.create({ data: { ...(await this.postData(input)), source: 'ADMIN' } });
    await this.audit.log(admin.id, 'blog.create', 'blog', p.id, { title: p.title });
    return toPostDto(p);
  }

  async updatePost(admin: User, id: string, input: PostInput) {
    const p = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Post not found');
    const data = await this.postData(input, p.id);
    // a live post keeps its address so links don't break
    if (p.status === 'PUBLISHED') data.slug = p.slug;
    const u = await this.prisma.blogPost.update({ where: { id }, data });
    await this.audit.log(admin.id, 'blog.update', 'blog', id, { title: u.title });
    return toPostDto(u);
  }

  async setPublished(admin: User, id: string, on: boolean) {
    const p = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Post not found');
    const u = await this.prisma.blogPost.update({ where: { id }, data: on ? { status: 'PUBLISHED', publishedAt: p.publishedAt ?? new Date() } : { status: 'DRAFT' } });
    await this.audit.log(admin.id, on ? 'blog.publish' : 'blog.unpublish', 'blog', id, { title: u.title });
    return toPostDto(u);
  }

  async deletePost(admin: User, id: string) {
    const p = await this.prisma.blogPost.delete({ where: { id } }).catch(() => null);
    if (!p) throw new NotFoundException('Post not found');
    await this.audit.log(admin.id, 'blog.delete', 'blog', id, { title: p.title });
    return { ok: true };
  }

  /** Validates and normalises a post; the slug is unique across built-in and stored posts. */
  private async postData(input: PostInput, id?: string) {
    const title = input.title?.trim();
    const excerpt = input.excerpt?.trim();
    if (!title || title.length < 8 || title.length > 140) throw new BadRequestException('Title should be 8–140 characters');
    if (!excerpt || excerpt.length < 20 || excerpt.length > 300) throw new BadRequestException('Summary should be 20–300 characters');
    const body = cleanBody(input.body);
    if (body.length < 3) throw new BadRequestException('The post needs at least a few paragraphs');
    let base = slugify(input.slug || title) || 'post';
    if (base.length < 3) base = `post-${base}`;
    let slug = base;
    for (let n = 2; ; n++) {
      const taken = POSTS.some((p) => p.slug === slug) || !!(await this.prisma.blogPost.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } }));
      if (!taken) break;
      slug = `${base}-${n}`;
    }
    return { slug, title, excerpt, emoji: (input.emoji || '📝').slice(0, 8), tone: TONES.includes(input.tone ?? '') ? input.tone! : 'sky', body: JSON.stringify(body) };
  }

  // ---------- admin: city guides ----------

  async listGuides() {
    const [rows, live] = await Promise.all([this.prisma.cityGuide.findMany({ orderBy: { updatedAt: 'desc' } }), this.coverage()]);
    return {
      items: rows.map(toGuideDto),
      builtIn: Object.keys(CITY_GUIDES),
      // cities with live hosts and no guide yet
      missing: Object.keys(live).filter((c) => !CITY_GUIDES[c] && !rows.some((r) => r.city === c)),
    };
  }

  async saveGuide(admin: User, city: string, input: GuideInput) {
    if (!cityBySlug(city)) throw new BadRequestException('Unknown city');
    const data = cleanGuide(input);
    const g = await this.prisma.cityGuide.upsert({ where: { city }, update: data, create: { city, ...data, source: 'ADMIN' } });
    await this.audit.log(admin.id, 'cityguide.save', 'cityguide', city, {});
    return toGuideDto(g);
  }

  async setGuidePublished(admin: User, city: string, on: boolean) {
    const g = await this.prisma.cityGuide.update({ where: { city }, data: { status: on ? 'PUBLISHED' : 'DRAFT' } }).catch(() => null);
    if (!g) throw new NotFoundException('Guide not found');
    await this.audit.log(admin.id, on ? 'cityguide.publish' : 'cityguide.unpublish', 'cityguide', city, {});
    return toGuideDto(g);
  }

  async deleteGuide(admin: User, city: string) {
    await this.prisma.cityGuide.delete({ where: { city } }).catch(() => null);
    await this.audit.log(admin.id, 'cityguide.delete', 'cityguide', city, {});
    return { ok: true };
  }

  // ---------- AI drafts ----------

  /** Hourly: on the chosen day (India time, after 9 am) write the week's drafts once; draft guides for new cities. */
  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const s = await this.settings.get();
      if (s.blogAutoEnabled === 1) {
        const ist = new Date(Date.now() + 330 * 60_000);
        const day = ist.getUTCDay() === 0 ? 7 : ist.getUTCDay();
        const week = istWeek();
        const last = await this.prisma.setting.findUnique({ where: { key: LAST_RUN } });
        if (day === s.blogDraftDay && ist.getUTCHours() >= 9 && last?.value !== week && s.blogDraftsPerWeek > 0) {
          await this.prisma.setting.upsert({ where: { key: LAST_RUN }, update: { value: week }, create: { key: LAST_RUN, value: week } });
          const made: string[] = [];
          for (let i = 0; i < s.blogDraftsPerWeek; i++) {
            try {
              made.push((await this.draftPost()).title);
            } catch (e) {
              this.log.warn(`blog draft failed: ${(e as Error).message}`);
            }
          }
          if (made.length)
            await this.mail.toAdmins(
              `${made.length} new blog draft${made.length === 1 ? '' : 's'} to review`,
              `New drafts: ${made.map((t) => `“${t}”`).join(', ')}. Read, edit and publish them in Admin → Blog & city guides — nothing goes live until you publish.`,
              '/admin/blog',
            );
        }
      }
      const { missing } = await this.listGuides();
      for (const city of missing.slice(0, 2)) {
        try {
          await this.draftGuide(city);
          await this.mail.toAdmins(
            `City guide draft ready: ${cityBySlug(city)?.name ?? city}`,
            `A host is live in ${cityBySlug(city)?.name ?? city}, so we drafted local text for its pages. Review and approve it in Admin → Blog & city guides → City guides.`,
            '/admin/blog?tab=guides',
          );
        } catch (e) {
          this.log.warn(`city guide draft for ${city} failed: ${(e as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** Writes one new draft post on a topic not covered yet. */
  async draftPost(topic?: string) {
    if (!this.client) throw new BadRequestException('AI writing isn’t set up on this server (ANTHROPIC_API_KEY)');
    const s = await this.settings.get();
    const model = MODELS[s.blogModel] ?? MODELS[1];
    const live = await this.coverage();
    const links = this.allowedLinks(live);
    const covered = [...POSTS.map((p) => p.title), ...(await this.prisma.blogPost.findMany({ select: { title: true } })).map((p) => p.title)];
    const prompt = `Write one new blog post for the Companio blog.

${topic ? `Topic requested by the editor: ${topic}` : 'Choose a fresh, useful topic that people in India actually search for — e.g. things to do in a city, moving to a city, making friends as an adult, finding a partner for an activity, safety when meeting someone new, solo travel, staying active. Prefer the cities and activities below where we have live hosts.'}

Cities and activities with live hosts right now:
${Object.entries(live)
  .map(([c, acts]) => `- ${cityBySlug(c)?.name ?? c}: ${acts.map((a) => CATEGORIES.find((x) => x.slug === a)?.name ?? a).join(', ')}`)
  .join('\n')}

Already published (do NOT repeat these topics):
${covered.map((t) => `- ${t}`).join('\n')}

Links you may use (only these exact paths, 3–6 of them, where they fit naturally): ${links.join(', ')}

Length: 700–1,100 words. Structure: an opening paragraph, 4–7 sections with short headings, some bullet lists, a closing paragraph that mentions verified hosts and safety once with a link to /safety or /explore.

Reply with JSON only, no other text:
{"title": "...", "excerpt": "one or two sentences, max 220 characters", "emoji": "one emoji", "tone": "pink|lime|sky|sunny|lavender", "body": [ "paragraph text", {"h": "Section heading"}, {"ul": ["item", "item"]} ]}
Text may use **bold** and [link text](/path).`;
    const res = await this.client.messages.create({ model, max_tokens: 6000, system: BRAND, messages: [{ role: 'user', content: prompt }] });
    const json = parseJson(res.content.map((c) => (c.type === 'text' ? c.text : '')).join(''));
    const body = stripLinks(cleanBody(json.body as Block[]), links);
    const data = await this.postData({ title: String(json.title ?? ''), excerpt: String(json.excerpt ?? '').slice(0, 300), emoji: String(json.emoji ?? '📝'), tone: String(json.tone ?? 'sky'), body });
    const p = await this.prisma.blogPost.create({ data: { ...data, source: 'AI', model } });
    this.log.log(`drafted “${p.title}” with ${model}`);
    return toPostDto(p);
  }

  /** Drafts local text for a city's landing pages (activities with live hosts there). */
  async draftGuide(city: string) {
    if (!this.client) throw new BadRequestException('AI writing isn’t set up on this server (ANTHROPIC_API_KEY)');
    const c = cityBySlug(city);
    if (!c) throw new BadRequestException('Unknown city');
    const s = await this.settings.get();
    const model = MODELS[s.blogModel] ?? MODELS[1];
    const acts = (await this.coverage())[city] ?? [];
    const prompt = `Write the local text for Companio's pages about ${c.name}, ${c.state}.

Activities with live hosts in ${c.name}: ${acts.map((a) => `${a} (${CATEGORIES.find((x) => x.slug === a)?.name ?? a})`).join(', ') || 'none yet — write the intro and FAQs only'}.

Reply with JSON only:
{"intro": ["paragraph about meeting people / getting out in ${c.name}: where plans usually happen", "paragraph on best areas, seasons/weather and timing"],
 "faqs": [{"q": "a local question people ask", "a": "short helpful answer"}, {"q": "...", "a": "..."}],
 "spots": {${acts.map((a) => `"${a}": "2–3 sentences: where people usually meet for this in ${c.name}"`).join(', ')}}}
Each paragraph 40–80 words. Only well-known public places.`;
    const res = await this.client.messages.create({ model, max_tokens: 3000, system: BRAND, messages: [{ role: 'user', content: prompt }] });
    const json = parseJson(res.content.map((x) => (x.type === 'text' ? x.text : '')).join(''));
    const data = cleanGuide(json as unknown as GuideInput, acts);
    const g = await this.prisma.cityGuide.upsert({ where: { city }, update: { ...data, status: 'DRAFT', source: 'AI' }, create: { city, ...data, status: 'DRAFT', source: 'AI' } });
    this.log.log(`drafted city guide for ${city} with ${model}`);
    return toGuideDto(g);
  }

  /** city → activities with at least one live host */
  private async coverage() {
    const rows = await this.prisma.companionProfile.findMany({ where: { isListed: true, kycStatus: 'APPROVED', user: { status: 'ACTIVE' } }, select: { city: true, categories: true } });
    const out: Record<string, string[]> = {};
    for (const r of rows) for (const a of r.categories.split(',')) if (a) (out[r.city] ??= []).includes(a) || out[r.city].push(a);
    return out;
  }

  private allowedLinks(live: Record<string, string[]>) {
    return ['/explore', '/safety', '/how-it-works', '/become-a-companion', ...Object.entries(live).flatMap(([c, acts]) => acts.map((a) => `/explore/${a}/${c}`)), ...POSTS.map((p) => `/blog/${p.slug}`)];
  }
}

function toPostDto(p: BlogPost): BlogPostDto {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    emoji: p.emoji,
    tone: p.tone as BlogPostDto['tone'],
    body: JSON.parse(p.body) as Block[],
    date: (p.publishedAt ?? p.createdAt).toISOString().slice(0, 10),
    status: p.status as BlogPostDto['status'],
    source: p.source as BlogPostDto['source'],
    model: p.model,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toGuideDto(g: CityGuideRow): CityGuideDto {
  return {
    city: g.city,
    intro: JSON.parse(g.intro),
    faqs: JSON.parse(g.faqs),
    spots: JSON.parse(g.spots),
    status: g.status as CityGuideDto['status'],
    source: g.source as CityGuideDto['source'],
    updatedAt: g.updatedAt.toISOString(),
  };
}

/** Keeps only well-formed blocks with sensible lengths. */
function cleanBody(body: unknown): Block[] {
  if (!Array.isArray(body)) return [];
  const out: Block[] = [];
  for (const b of body.slice(0, 80)) {
    if (typeof b === 'string' && b.trim()) out.push(b.trim().slice(0, 2000));
    else if (b && typeof b === 'object' && typeof (b as { h?: unknown }).h === 'string' && (b as { h: string }).h.trim()) out.push({ h: (b as { h: string }).h.trim().slice(0, 140) });
    else if (b && typeof b === 'object' && Array.isArray((b as { ul?: unknown }).ul)) {
      const ul = ((b as { ul: unknown[] }).ul.filter((x) => typeof x === 'string' && x.trim()) as string[]).map((x) => x.trim().slice(0, 600)).slice(0, 15);
      if (ul.length) out.push({ ul });
    }
  }
  return out;
}

/** AI text may only link to pages we have; other links become plain text. */
function stripLinks(body: Block[], allowed: string[]): Block[] {
  const fix = (t: string) => t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text: string, href: string) => (allowed.includes(href) ? m : text));
  return body.map((b) => (typeof b === 'string' ? fix(b) : 'h' in b ? b : { ul: b.ul.map(fix) }));
}

function cleanGuide(input: GuideInput, acts?: string[]) {
  const intro = (Array.isArray(input?.intro) ? input.intro : []).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 1200)).slice(0, 4);
  const faqs = (Array.isArray(input?.faqs) ? input.faqs : [])
    .filter((f) => f && typeof f.q === 'string' && typeof f.a === 'string' && f.q.trim() && f.a.trim())
    .map((f) => ({ q: f.q.trim().slice(0, 200), a: f.a.trim().slice(0, 1000) }))
    .slice(0, 4);
  const spots: Record<string, string> = {};
  for (const [k, v] of Object.entries(input?.spots ?? {}))
    if (CATEGORIES.some((c) => c.slug === k) && (!acts || acts.includes(k)) && typeof v === 'string' && v.trim()) spots[k] = v.trim().slice(0, 800);
  if (!intro.length) throw new BadRequestException('Add at least one intro paragraph');
  return { intro: JSON.stringify(intro), faqs: JSON.stringify(faqs), spots: JSON.stringify(spots) };
}

function parseJson(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('The AI reply had no JSON');
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}
