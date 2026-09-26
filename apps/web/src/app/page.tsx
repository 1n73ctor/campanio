import Link from 'next/link';
import { CATEGORIES, CITIES, POPULAR_CITIES } from '@companio/types';
import { Avatar, Badge, Card, buttonClass, cn, toneSolid } from '@companio/ui';
import { CompanionCard } from '@/components/companion-card';
import { SearchBar } from '@/components/search-bar';
import { Faq, JsonLd } from '@/components/misc';
import { serverApi, safe } from '@/lib/server-api';
import { SITE_URL } from '@/lib/env';

export const revalidate = 300;

const STEPS = [
  { n: '01', title: 'Pick your vibe', body: 'Browse verified companions by activity, city, price and language. Read real reviews.', tone: 'pink' as const },
  { n: '02', title: 'Book & pay safely', body: 'Choose a time and a public meeting spot. Your payment waits in escrow — UPI, cards, or wallet.', tone: 'lime' as const },
  { n: '03', title: 'Meet & enjoy', body: 'Share your 4-digit start code in person. Live location + SOS are one tap away the whole time.', tone: 'sky' as const },
];

const SAFETY = [
  { icon: '🪪', title: 'ID + selfie verified', body: 'Government ID and a live-selfie liveness check for every companion.' },
  { icon: '🔐', title: 'Escrow payments', body: 'Money is released only after your session. No-show? Automatic refund.' },
  { icon: '📍', title: 'Live location sharing', body: 'Share your live location during a booking with someone you trust.' },
  { icon: '🚨', title: 'One-tap SOS', body: 'Alerts our 24/7 safety team with your location instantly.' },
  { icon: '🙈', title: 'Private by default', body: 'Numbers, UPI IDs and links are hidden in chat. No off-platform pressure.' },
  { icon: '🤝', title: 'Strictly platonic', body: 'Zero tolerance for sexual or romantic solicitation. 18+ only.' },
];

const FAQS = [
  { q: 'What is Companio?', a: 'A platform to book friendly, verified people for activities — a gym partner, a movie buddy, a local guide, a plus-one for an event. It’s companionship, not dating.' },
  { q: 'How much does it cost?', a: 'Companions set their own hourly rates (typically ₹299–₹999/hr). Each booking has a small connection fee plus GST. You always see the full breakdown before paying.' },
  { q: 'How do I know it’s safe?', a: 'Every companion is ID-verified with a liveness check, meetups are in public places, payments sit in escrow, and you get live location sharing and SOS during every booking.' },
  { q: 'Can I become a companion?', a: 'Yes! If you’re 18+, friendly and reliable, apply in minutes. Set your own rate and hours, and withdraw earnings to UPI.' },
];

export default async function Home() {
  const api = serverApi(300);
  const featured = await safe(api.companions.search({ sort: 'rating', pageSize: 8 }), { items: [], total: 0, page: 1, pageSize: 8 });
  const hero = featured.items.slice(0, 3);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Companio',
          url: SITE_URL,
          logo: `${SITE_URL}/pwa-icon/512`,
          sameAs: [],
        }}
      />
      {/* HERO */}
      <section className="dots relative overflow-x-clip border-b-3 border-ink">
        <div className="container-x grid items-center gap-12 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div>
            <Badge tone="lime" className="mb-5 -rotate-2 px-3 py-1 text-sm">
              ✨ 100% platonic · 18+ · ID-verified
            </Badge>
            <h1 className="text-[44px] font-extrabold leading-[0.95] sm:text-6xl lg:text-7xl">
              Rent a friend,
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">not a date.</span>
                <span className="absolute -bottom-1 left-0 right-0 z-0 h-5 -rotate-1 bg-pink sm:h-7" aria-hidden />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-soft">
              Gym partners, movie buddies, city guides and event plus-ones — verified humans for the things that are better together. Book in minutes, pay safely, have fun.
            </p>
            <div className="mt-8 max-w-2xl">
              <SearchBar />
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink-soft">
              <span>🔐 Escrow payments</span>
              <span>📍 Live location</span>
              <span>🚨 24/7 SOS</span>
              <span>💸 UPI in one tap</span>
            </div>
          </div>
          <div className="relative mx-auto hidden h-[440px] w-full max-w-md lg:block">
            {hero.map((c, i) => (
              <Card
                key={c.id}
                tone={(['pink', 'lime', 'sky'] as const)[i]}
                className={cn(
                  'absolute w-72 p-4',
                  i === 0 && 'left-0 top-0 -rotate-6 animate-floaty',
                  i === 1 && 'right-0 top-28 rotate-3',
                  i === 2 && 'bottom-0 left-8 -rotate-2 animate-floaty [animation-delay:1.2s]',
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} src={c.avatarUrl} size={52} />
                  <div>
                    <p className="font-display text-lg font-extrabold">
                      {c.name.split(' ')[0]} {c.verified && '✅'}
                    </p>
                    <p className="text-sm">★ {c.ratingAvg.toFixed(1)} · ₹{c.hourlyRate}/hr</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold">“{c.headline}”</p>
              </Card>
            ))}
            {!hero.length && (
              <Card tone="sunny" className="absolute inset-10 flex items-center justify-center p-6 text-center text-xl font-extrabold">
                Your next plan starts here 🎉
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-b-3 border-ink bg-ink py-3 text-paper" aria-hidden>
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-lg font-bold">
          {[...CATEGORIES, ...CATEGORIES].map((c, i) => (
            <span key={i}>
              {c.emoji} {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* CATEGORIES */}
      <section className="container-x py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-extrabold sm:text-4xl">What are we doing today?</h2>
          <Link href="/explore" className="hidden font-bold underline sm:block">
            See all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c, i) => (
            <Link key={c.slug} href={`/explore/${c.slug}`} className="group">
              <div className={cn('brutal brutal-press flex h-full flex-col gap-2 rounded-blob p-4', toneSolid[c.color], i % 2 ? 'rotate-1' : '-rotate-1', 'hover:rotate-0')}>
                <span className="text-4xl">{c.emoji}</span>
                <span className="font-display text-lg font-extrabold leading-tight">{c.name}</span>
                <span className="text-xs font-medium text-ink-soft">{c.blurb}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y-3 border-ink bg-lavender-soft py-16">
        <div className="container-x">
          <h2 className="mb-10 text-3xl font-extrabold sm:text-4xl">Three steps. Zero awkward.</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <Card key={s.n} className="relative p-6 pt-10">
                <span className={cn('absolute -top-5 left-6 rounded-chunky border-3 border-ink px-3 py-1 font-display text-xl font-extrabold', toneSolid[s.tone])}>{s.n}</span>
                <h3 className="text-xl font-extrabold">{s.title}</h3>
                <p className="mt-2 text-ink-soft">{s.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED */}
      {featured.items.length > 0 && (
        <section className="container-x py-16">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">Top-rated this week</h2>
              <p className="mt-1 text-ink-soft">Verified, reviewed, ready to hang.</p>
            </div>
            <Link href="/explore?sort=rating" className={buttonClass('white', 'sm')}>
              Browse all
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.items.map((c) => (
              <CompanionCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      {/* SAFETY */}
      <section className="border-y-3 border-ink bg-ink py-16 text-paper">
        <div className="container-x">
          <Badge tone="lime" className="mb-4">
            Safety is the product
          </Badge>
          <h2 className="max-w-2xl text-3xl font-extrabold sm:text-5xl">Built so everyone feels safe showing up.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SAFETY.map((s) => (
              <div key={s.title} className="rounded-blob border-3 border-paper/80 bg-ink p-5">
                <span className="text-3xl">{s.icon}</span>
                <h3 className="mt-3 text-lg font-extrabold">{s.title}</h3>
                <p className="mt-1 text-sm text-paper/70">{s.body}</p>
              </div>
            ))}
          </div>
          <Link href="/safety" className={buttonClass('lime', 'md', 'mt-10')}>
            How we keep you safe →
          </Link>
        </div>
      </section>

      {/* CITIES */}
      <section className="container-x py-16">
        <h2 className="mb-6 text-3xl font-extrabold sm:text-4xl">Popular cities</h2>
        <div className="flex flex-wrap items-center gap-3">
          {POPULAR_CITIES.map((c) => (
            <Link key={c.slug} href={`/explore?city=${c.slug}`} className="brutal brutal-press rounded-full bg-white px-5 py-2.5 font-display font-bold">
              📍 {c.name}
            </Link>
          ))}
          <Link href="/explore" className="px-2 font-display font-bold underline">
            + {CITIES.length - POPULAR_CITIES.length} more cities
          </Link>
        </div>
      </section>

      {/* BECOME */}
      <section className="container-x">
        <Card tone="sunny" className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-5xl">Good company? Get paid for it.</h2>
            <p className="mt-3 max-w-lg text-lg text-ink-soft">Set your own rate and hours. Do things you already love. Withdraw earnings to UPI whenever you want.</p>
            <Link href="/become-a-companion" className={buttonClass('dark', 'lg', 'mt-6')}>
              Become a companion
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            {[
              ['₹30k+', 'monthly, top companions'],
              ['85%', 'of every booking is yours'],
              ['24h', 'to your wallet after a session'],
              ['0', 'joining fees'],
            ].map(([a, b]) => (
              <div key={b} className="rounded-chunky border-3 border-ink bg-white p-4">
                <p className="font-display text-2xl font-extrabold">{a}</p>
                <p className="text-xs font-semibold text-ink-soft">{b}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* FAQ */}
      <section className="container-x max-w-3xl py-16">
        <h2 className="mb-6 text-3xl font-extrabold">Questions, answered</h2>
        <Faq items={FAQS} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />
      </section>
    </>
  );
}
