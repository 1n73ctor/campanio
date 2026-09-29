import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURED_CATEGORIES, FEATURED_CITIES, categoryBySlug, cityBySlug } from '@companio/types';
import { Landing } from '@/components/landing';
import { landingCopy } from '@/lib/seo';
import { serverApi, safe } from '@/lib/server-api';

/** One page per category × city (ISR). This is the SEO acquisition engine. */
export const revalidate = 600;
// featured activities × featured cities are pre-rendered at build; the rest render on first visit and are then cached
// (unknown slugs 404 below). Keeps the build's API calls well under the API's rate limit as activities are added.
export const dynamicParams = true;
export const generateStaticParams = () => FEATURED_CATEGORIES.flatMap((c) => FEATURED_CITIES.map((city) => ({ category: c.slug, city: city.slug })));

type Params = { category: string; city: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const cat = categoryBySlug(p.category);
  const city = cityBySlug(p.city);
  if (!cat || !city) return {};
  const copy = landingCopy(cat, city);
  const canonical = `/explore/${cat.slug}/${city.slug}`;
  return { title: copy.title, description: copy.description, alternates: { canonical }, openGraph: { title: copy.title, description: copy.description, url: canonical } };
}

export default async function CategoryCityPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const cat = categoryBySlug(p.category);
  const city = cityBySlug(p.city);
  if (!cat || !city) notFound();
  const data = await safe(
    serverApi(600).companions.search({
      category: cat.slug,
      city: city.slug,
      sort: 'recommended',
      pageSize: 12,
    }),
    { items: [], total: 0, page: 1, pageSize: 12 },
  );
  return <Landing cat={cat} city={city} data={data} />;
}
