import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { CompanionSearchQuery } from '@companio/types';
import { ExploreFilters } from '@/components/explore-filters';
import { PageHeader } from '@/components/misc';
import { Results } from '@/components/results';
import { serverApi, safe } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Explore companions',
  description: 'Browse verified companions by activity, city, price and language.',
  alternates: { canonical: '/explore' },
};

type SP = Record<string, string | undefined>;

export default async function Explore({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q: CompanionSearchQuery = {
    category: sp.category,
    city: sp.city,
    q: sp.q,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    gender: sp.gender as CompanionSearchQuery['gender'],
    language: sp.language,
    sort: (sp.sort as CompanionSearchQuery['sort']) ?? 'recommended',
    when: sp.when === 'today' || sp.when === 'weekend' ? sp.when : undefined,
    page: sp.page ? Number(sp.page) : 1,
    pageSize: 12,
  };
  const data = await safe(serverApi(60).companions.search(q), { items: [], total: 0, page: 1, pageSize: 12 });
  return (
    <div className="container-x">
      <PageHeader eyebrow="Explore" title="Find your kind of company" subtitle="Every companion is ID-verified and reviewed by real members." />
      <Suspense>
        <ExploreFilters />
      </Suspense>
      <div className="mt-8">
        <Results data={data} basePath="/explore" params={sp} />
      </div>
    </div>
  );
}
