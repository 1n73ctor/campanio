import type { MetadataRoute } from 'next';
import { CATEGORIES, CITIES } from '@companio/types';
import { SITE_URL } from '@/lib/env';
import { POSTS } from '@/lib/blog';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = ['', '/explore', '/how-it-works', '/safety', '/become-a-companion', '/blog', '/community-guidelines', '/terms', '/privacy'];
  return [
    ...staticPages.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 })),
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/explore/${c.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 })),
    // category × city landing pages — the cheapest acquisition channel
    ...CATEGORIES.flatMap((c) => CITIES.map((city) => ({ url: `${SITE_URL}/explore/${c.slug}/${city.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 }))),
    ...POSTS.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: new Date(p.date), priority: 0.5 })),
  ];
}
