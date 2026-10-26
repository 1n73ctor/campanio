import type { MetadataRoute } from 'next';
import { CATEGORIES, CITIES } from '@companio/types';
import { SITE_URL } from '@/lib/env';
import { allPosts } from '@/lib/posts';
import { safe, serverApi } from '@/lib/server-api';

// rebuilt hourly from live data: only pages with hosts on them (empty ones are noindex until a host joins)
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const api = serverApi(3600);
  const [coverage, hosts, posts] = await Promise.all([safe(api.meta.coverage(), null), safe(api.meta.hosts(), []), allPosts()]);
  // API unreachable: list every page as before rather than drop them
  const has = (cat: string, city?: string) =>
    !coverage || (city ? (coverage[city]?.[cat] ?? 0) > 0 : Object.values(coverage).some((c) => (c[cat] ?? 0) > 0));

  const staticPages = ['', '/explore', '/how-it-works', '/safety', '/become-a-companion', '/blog', '/community-guidelines', '/terms', '/privacy'];
  return [
    ...staticPages.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 })),
    ...CATEGORIES.filter((c) => has(c.slug)).map((c) => ({ url: `${SITE_URL}/explore/${c.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 })),
    // category × city landing pages with at least one live host — the cheapest acquisition channel
    ...CATEGORIES.flatMap((c) =>
      CITIES.filter((city) => has(c.slug, city.slug)).map((city) => ({ url: `${SITE_URL}/explore/${c.slug}/${city.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 })),
    ),
    ...hosts.map((h) => ({ url: `${SITE_URL}/companions/${h.id}`, lastModified: new Date(h.updatedAt), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: new Date(p.date), priority: 0.5 })),
  ];
}
