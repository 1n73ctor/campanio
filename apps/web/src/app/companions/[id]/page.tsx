import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CATEGORIES, WEEKDAYS, cityBySlug, formatINR } from '@companio/types';
import { Avatar, Badge, Card, Stars, buttonClass } from '@companio/ui';
import { JsonLd } from '@/components/misc';
import { ProfileActions } from '@/components/profile-actions';
import { serverApi } from '@/lib/server-api';
import { fmtDate } from '@/lib/format';
import { SITE_URL } from '@/lib/env';

export const revalidate = 120;
// empty list + revalidate = profiles are rendered on first visit, then cached (ISR)
export const generateStaticParams = () => [];

async function load(id: string) {
  try {
    return await serverApi(120).companions.get(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await load((await params).id);
  if (!c) return { title: 'Companion not found' };
  const first = c.name.split(' ')[0];
  const city = cityBySlug(c.city)?.name;
  return {
    title: `${first} — ${c.headline}`,
    description: `Book ${first}, a verified companion in ${city}, from ${formatINR(c.hourlyRate)}/hr. ${c.ratingCount} reviews, ${c.ratingAvg.toFixed(1)}★.`,
    alternates: { canonical: `/companions/${c.id}` },
    openGraph: { title: `${first} on Companio`, description: c.headline, images: c.avatarUrl ? [c.avatarUrl] : undefined },
  };
}

const DAY_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

export default async function CompanionPage({ params }: { params: Promise<{ id: string }> }) {
  const c = await load((await params).id);
  if (!c) notFound();
  const first = c.name.split(' ')[0];
  const cats = c.categories.map((s) => CATEGORIES.find((x) => x.slug === s)).filter(Boolean);
  const city = cityBySlug(c.city);

  return (
    <div className="container-x py-8">
      <nav className="mb-4 text-sm font-semibold">
        <Link href="/explore" className="underline">
          Explore
        </Link>
        {city && (
          <>
            {' / '}
            <Link href={`/explore/${cats[0]?.slug}/${city.slug}`} className="underline">
              {cats[0]?.name} in {city.name}
            </Link>
          </>
        )}
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card tone="pink" className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <Avatar name={c.name} src={c.avatarUrl} size={112} className="shadow-brutal" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-4xl font-extrabold">{first}</h1>
                {c.age && <span className="text-xl font-semibold">{c.age}</span>}
                {c.verified && <Badge tone="lime">✅ ID verified</Badge>}
              </div>
              <p className="mt-1 text-lg font-semibold">{c.headline}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm font-semibold">
                <Stars value={c.ratingAvg} count={c.ratingCount} />
                <span>📍 {city?.name}</span>
                <span>🗣 {c.languages.join(', ')}</span>
                <span>🤝 {c.completedBookings} meetups</span>
              </div>
            </div>
          </Card>

          {c.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {c.photos.map((p, i) => (
                <img key={p} src={p} alt={`${first} photo ${i + 1}`} className="aspect-square w-full rounded-chunky border-3 border-ink object-cover" />
              ))}
            </div>
          )}

          <Card className="p-6">
            <h2 className="mb-3 text-xl font-extrabold">About {first}</h2>
            <p className="whitespace-pre-line text-ink-soft">{c.about}</p>
            {c.bio && <p className="mt-3 text-sm text-ink-mute">{c.bio}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {cats.map((cat) => (
                <Link key={cat!.slug} href={`/explore/${cat!.slug}/${c.city}`}>
                  <Badge tone={cat!.color} className="px-3 py-1 text-sm">
                    {cat!.emoji} {cat!.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-3 text-xl font-extrabold">Weekly availability</h2>
            <div className="grid grid-cols-4 gap-2 text-center text-xs sm:grid-cols-7">
              {WEEKDAYS.map((d) => {
                const slots = c.availability[d] ?? [];
                return (
                  <div key={d} className={`rounded-chunky border-2 border-ink p-2 ${slots.length ? 'bg-lime-soft' : 'bg-paper-deep text-ink-mute'}`}>
                    <p className="font-display font-bold">{DAY_LABEL[d]}</p>
                    {slots.length ? slots.map((s) => <p key={s.from} className="mt-1 leading-tight">{s.from}–{s.to}</p>) : <p className="mt-1">—</p>}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-mute">Times in IST. {Object.keys(c.availability).length === 0 && 'Flexible — request any time.'}</p>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-xl font-extrabold">
              Reviews <span className="text-ink-mute">({c.ratingCount})</span>
            </h2>
            {c.reviews.length === 0 ? (
              <p className="text-ink-soft">No reviews yet — be the first!</p>
            ) : (
              <ul className="space-y-4">
                {c.reviews.map((r) => (
                  <li key={r.id} className="border-b-2 border-dashed border-ink/15 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{r.authorName}</p>
                      <span className="text-sm text-sunny-deep">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-ink-soft">{r.comment}</p>}
                    <p className="mt-1 text-xs text-ink-mute">{fmtDate(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4 p-6">
            <p className="font-display text-3xl font-extrabold">
              {formatINR(c.hourlyRate)}
              <span className="text-base font-semibold text-ink-mute">/hour</span>
            </p>
            <p className="text-sm text-ink-soft">+ a small connection fee & GST. Full breakdown before you pay.</p>
            <Link href={`/book/${c.id}`} className={buttonClass('primary', 'lg', 'w-full')}>
              Book {first}
            </Link>
            <ul className="space-y-1.5 text-sm">
              <li>🔐 Paid into escrow — released after the meetup</li>
              <li>↩️ Full refund if {first} declines or doesn’t show</li>
              <li>📍 Public places only · live location & SOS</li>
            </ul>
            <p className="border-t-2 border-dashed border-ink/15 pt-3 text-xs text-ink-mute">Member since {fmtDate(c.memberSince)}</p>
          </Card>
          <ProfileActions companionUserId={c.userId} name={first} />
        </aside>
      </div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: `${cats[0]?.name ?? 'Companion'} — ${first}`,
          areaServed: city?.name,
          provider: { '@type': 'Person', name: first },
          offers: { '@type': 'Offer', price: c.hourlyRate, priceCurrency: 'INR', url: `${SITE_URL}/companions/${c.id}` },
          ...(c.ratingCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: c.ratingAvg, reviewCount: c.ratingCount } } : {}),
        }}
      />
    </div>
  );
}
