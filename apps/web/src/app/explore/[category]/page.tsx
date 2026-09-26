import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CATEGORIES, categoryBySlug } from '@companio/types';
import { Landing } from '@/components/landing';
import { landingCopy } from '@/lib/seo';
import { serverApi, safe } from '@/lib/server-api';

export const revalidate = 600;
export const dynamicParams = false;
export const generateStaticParams = () => CATEGORIES.map((c) => ({ category: c.slug }));

type Params = { category: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const cat = categoryBySlug((await params).category);
  if (!cat) return {};
  const copy = landingCopy(cat);
  return { title: copy.title, description: copy.description, alternates: { canonical: `/explore/${cat.slug}` }, openGraph: { title: copy.title, description: copy.description } };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const cat = categoryBySlug((await params).category);
  if (!cat) notFound();
  const data = await safe(
    serverApi(600).companions.search({
      category: cat.slug,
      sort: 'recommended',
      pageSize: 12,
    }),
    { items: [], total: 0, page: 1, pageSize: 12 },
  );
  return <Landing cat={cat} data={data} />;
}
