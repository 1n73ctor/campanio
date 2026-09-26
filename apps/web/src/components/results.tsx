import Link from 'next/link';
import type { CompanionCardDto, Paginated } from '@companio/types';
import { EmptyState, buttonClass } from '@companio/ui';
import { CompanionCard } from './companion-card';

export function Results({ data, basePath, params }: { data: Paginated<CompanionCardDto>; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    q.set('page', String(p));
    return `${basePath}?${q.toString()}`;
  };
  if (!data.items.length) {
    return (
      <EmptyState
        emoji="🔍"
        title="No companions match (yet)"
        body="Try widening your filters or another city. We’re onboarding new companions every week."
        action={
          <Link href="/explore" className={buttonClass('primary')}>
            Reset filters
          </Link>
        }
      />
    );
  }
  return (
    <>
      <p className="mb-4 text-sm font-semibold text-ink-soft">
        {data.total} companion{data.total === 1 ? '' : 's'}
      </p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.items.map((c) => (
          <CompanionCard key={c.id} c={c} />
        ))}
      </div>
      {pages > 1 && (
        <nav className="mt-10 flex justify-center gap-2" aria-label="Pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={href(p)} className={buttonClass(p === data.page ? 'dark' : 'white', 'sm')} aria-current={p === data.page ? 'page' : undefined}>
              {p}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
