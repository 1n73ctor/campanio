import Link from 'next/link';
import { Suspense } from 'react';
import { CATEGORIES, CITIES, type Category, type City, type CompanionCardDto, type Paginated } from '@companio/types';
import { Badge, toneSolid, cn } from '@companio/ui';
import { ExploreFilters } from './explore-filters';
import { Faq, JsonLd } from './misc';
import { Results } from './results';
import { landingCopy } from '@/lib/seo';
import { SITE_URL } from '@/lib/env';

/** Shared template for /explore/[category] and /explore/[category]/[city] SEO landing pages. */
export function Landing({ cat, city, data }: { cat: Category; city?: City; data: Paginated<CompanionCardDto> }) {
  const copy = landingCopy(cat, city);
  const path = `/explore/${cat.slug}${city ? `/${city.slug}` : ''}`;
  return (
    <>
      <section className={cn('border-b-3 border-ink', toneSolid[cat.color])}>
        <div className="container-x py-10 sm:py-14">
          <nav className="mb-4 text-sm font-semibold" aria-label="Breadcrumb">
            <Link href="/explore" className="underline">
              Explore
            </Link>
            {' / '}
            {city ? (
              <>
                <Link href={`/explore/${cat.slug}`} className="underline">
                  {cat.name}
                </Link>
                {' / '}
                {city.name}
              </>
            ) : (
              cat.name
            )}
          </nav>
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-blob border-3 border-ink bg-white text-4xl shadow-brutal">{cat.emoji}</span>
            <h1 className="text-3xl font-extrabold sm:text-5xl">{copy.title}</h1>
          </div>
          <p className="mt-4 max-w-2xl text-lg">{copy.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="white">🪪 ID-verified</Badge>
            <Badge tone="white">🔐 Escrow payments</Badge>
            <Badge tone="white">🚨 SOS on every booking</Badge>
          </div>
        </div>
      </section>
      <div className="container-x py-8">
        <Suspense>
          <ExploreFilters lockCategory lockCity={!!city} preset={{ category: cat.slug, ...(city ? { city: city.slug } : {}) }} />
        </Suspense>
        <div className="mt-8">
          <Results data={data} basePath="/explore" params={{ category: cat.slug, city: city?.slug }} />
        </div>

        <section className="mt-16 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="mb-4 text-2xl font-extrabold">
              {cat.name}
              {city ? ` in ${city.name}` : ''}: FAQs
            </h2>
            <Faq items={copy.faqs} />
          </div>
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-lg font-extrabold">{city ? `More in ${city.name}` : 'Popular cities'}</h2>
              <div className="flex flex-wrap gap-2">
                {city
                  ? CATEGORIES.filter((c) => c.slug !== cat.slug).map((c) => (
                      <Link key={c.slug} href={`/explore/${c.slug}/${city.slug}`} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-semibold hover:bg-paper-deep">
                        {c.emoji} {c.name}
                      </Link>
                    ))
                  : CITIES.map((c) => (
                      <Link key={c.slug} href={`/explore/${cat.slug}/${c.slug}`} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-semibold hover:bg-paper-deep">
                        {cat.name} in {c.name}
                      </Link>
                    ))}
              </div>
            </div>
            {city && (
              <div>
                <h2 className="mb-3 text-lg font-extrabold">{cat.name} in other cities</h2>
                <div className="flex flex-wrap gap-2">
                  {CITIES.filter((c) => c.slug !== city.slug).map((c) => (
                    <Link key={c.slug} href={`/explore/${cat.slug}/${c.slug}`} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-semibold hover:bg-paper-deep">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Explore', item: `${SITE_URL}/explore` },
              { '@type': 'ListItem', position: 2, name: cat.name, item: `${SITE_URL}/explore/${cat.slug}` },
              ...(city ? [{ '@type': 'ListItem', position: 3, name: city.name, item: `${SITE_URL}${path}` }] : []),
            ],
          },
          { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: copy.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: data.items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/companions/${c.id}`, name: c.name })),
          },
        ]}
      />
    </>
  );
}
