'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CATEGORIES, CITIES, GENDERS, LANGUAGES, humanize } from '@companio/types';
import { Button, Chip, Input, Select } from '@companio/ui';

/**
 * On /explore filters update the URL in place. On static SEO landing pages (`preset` given) they hand off to
 * /explore with the page's category/city pre-applied, so the landing pages themselves stay fully static (ISR).
 */
export function ExploreFilters({ lockCategory, lockCity, preset }: { lockCategory?: boolean; lockCity?: boolean; preset?: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(preset ?? sp.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete('page');
    router.push(`${preset ? '/explore' : pathname}?${next.toString()}`, { scroll: !!preset });
  };

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set('q', q.trim() || null);
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or vibe… (e.g. “heritage”, “trekking”)" aria-label="Search" />
        <Button type="submit" variant="dark">
          Search
        </Button>
      </form>
      {!lockCategory && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={!sp.get('category')} onClick={() => set('category', null)}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.slug} active={sp.get('category') === c.slug} onClick={() => set('category', c.slug)}>
              {c.emoji} {c.name}
            </Chip>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {!lockCity && (
          <Select aria-label="City" value={sp.get('city') ?? ''} onChange={(e) => set('city', e.target.value || null)}>
            <option value="">All cities</option>
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Max price" value={sp.get('maxPrice') ?? ''} onChange={(e) => set('maxPrice', e.target.value || null)}>
          <option value="">Any price</option>
          {[399, 499, 699, 999].map((p) => (
            <option key={p} value={p}>
              Up to ₹{p}/hr
            </option>
          ))}
        </Select>
        <Select aria-label="Gender" value={sp.get('gender') ?? ''} onChange={(e) => set('gender', e.target.value || null)}>
          <option value="">Any gender</option>
          {GENDERS.filter((g) => g !== 'PREFER_NOT_TO_SAY').map((g) => (
            <option key={g} value={g}>
              {humanize(g)}
            </option>
          ))}
        </Select>
        <Select aria-label="Language" value={sp.get('language') ?? ''} onChange={(e) => set('language', e.target.value || null)}>
          <option value="">Any language</option>
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </Select>
        <Select aria-label="Sort" value={sp.get('sort') ?? 'recommended'} onChange={(e) => set('sort', e.target.value)}>
          <option value="recommended">Recommended</option>
          <option value="rating">Top rated</option>
          <option value="price_asc">Price: low → high</option>
          <option value="price_desc">Price: high → low</option>
          <option value="newest">Newest</option>
        </Select>
      </div>
    </div>
  );
}
