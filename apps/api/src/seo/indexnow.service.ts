import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { config } from '../common/config';

/** Public by design: the same key is served as https://<site>/<key>.txt (apps/web/public) to prove we own the site. */
export const INDEXNOW_KEY = '17582cccddad05b077453533a2efb67b';
const STATE = 'indexnow.state';
const HOUR = 3600_000;

/**
 * IndexNow (Bing, Yandex, Seznam…): once an hour, reads the website's sitemap and tells search engines which pages are
 * new, changed or gone, so they're recrawled within hours instead of weeks. Google doesn't use IndexNow — it reads the
 * sitemap itself. Only runs for a real https site.
 */
@Injectable()
export class IndexNowService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('IndexNow');
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService) {}

  private get enabled() {
    return process.env.DISABLE_JOBS !== 'true' && /^https:\/\//.test(config.webUrl) && !/localhost|127\.0\.0\.1/.test(config.webUrl);
  }

  onModuleInit() {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.run().catch((e) => this.log.warn(String(e))), HOUR);
    setTimeout(() => void this.run().catch((e) => this.log.warn(String(e))), 2 * 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    const res = await fetch(`${config.webUrl}/sitemap.xml`, { headers: { 'user-agent': 'Companio-IndexNow' } });
    if (!res.ok) throw new Error(`sitemap ${res.status}`);
    const xml = await res.text();
    // url → version: host profiles and blog posts change with their lastmod; other pages only matter when added or removed
    const now: Record<string, string> = {};
    for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const loc = m[1].match(/<loc>([^<]+)<\/loc>/)?.[1];
      if (!loc) continue;
      const lastmod = m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '';
      now[loc] = /\/(companions|blog)\//.test(loc) ? lastmod : '';
    }
    if (!Object.keys(now).length) return;
    const saved = await this.prisma.setting.findUnique({ where: { key: STATE } });
    const before = saved ? (JSON.parse(saved.value) as Record<string, string>) : {};
    const changed = Object.keys(now).filter((u) => before[u] !== now[u]);
    const removed = Object.keys(before).filter((u) => !(u in now));
    const urls = [...changed, ...removed];
    if (urls.length) {
      const host = new URL(config.webUrl).host;
      for (let i = 0; i < urls.length; i += 10_000) {
        const r = await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${config.webUrl}/${INDEXNOW_KEY}.txt`, urlList: urls.slice(i, i + 10_000) }),
        });
        // 200 = received, 202 = accepted (key check pending); anything else: try again next hour
        if (r.status !== 200 && r.status !== 202) throw new Error(`IndexNow ${r.status}: ${(await r.text()).slice(0, 200)}`);
      }
      this.log.log(`sent ${changed.length} new/changed and ${removed.length} removed page(s)`);
    }
    await this.prisma.setting.upsert({ where: { key: STATE }, update: { value: JSON.stringify(now) }, create: { key: STATE, value: JSON.stringify(now) } });
  }
}
