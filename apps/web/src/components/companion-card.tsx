import Link from 'next/link';
import type { CompanionCardDto } from '@companio/types';
import { CATEGORIES, cityBySlug, formatINR } from '@companio/types';
import { Badge, Card, Stars } from '@companio/ui';
import { CardPhoto } from './card-photo';
import { PremiumCard } from './premium';

export function CompanionCard({ c }: { c: CompanionCardDto }) {
  if (c.premium) return <PremiumCard c={c} />;
  const first = c.name.split(' ')[0];
  const cats = c.categories.map((s) => CATEGORIES.find((x) => x.slug === s)).filter(Boolean);
  return (
    <Link href={`/companions/${c.id}`} className="group block focus:outline-none">
      <Card interactive className="flex h-full flex-col overflow-hidden">
        <div className="relative aspect-[16/10] overflow-hidden border-b-3 border-ink sm:aspect-[4/3]">
          <CardPhoto src={c.avatarUrl} name={first} categories={c.categories} alt={first} className="transition-transform duration-300 group-hover:scale-105" />
          {(c.freeToday || c.freeWeekend) && (
            <span className={`absolute right-3 top-3 rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-extrabold shadow-brutal-sm ${c.freeToday ? 'bg-lime' : 'bg-sky-soft'}`}>
              {c.freeToday ? '🟢 Free today' : '🗓️ Weekend'}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-lg font-extrabold">{first}</h3>
            {c.age && <span className="text-ink-mute">· {c.age}</span>}
            {c.verified && (
              <span title="ID verified" className="text-sm">
                ✅
              </span>
            )}
            <span className="ml-auto shrink-0 text-sm text-ink-soft">{cityBySlug(c.city)?.name}</span>
          </div>
          <Stars value={c.ratingAvg} count={c.ratingCount} />
          <p className="line-clamp-2 text-sm font-medium">{c.headline}</p>
          <div className="flex flex-wrap gap-1.5">
            {cats.slice(0, 3).map((cat) => (
              <Badge key={cat!.slug} tone={cat!.color}>
                {cat!.emoji} {cat!.name}
              </Badge>
            ))}
            {c.womenOnly && (
              <Badge tone="pink" title="Only accepts meetups from women">
                👩 Women only
              </Badge>
            )}
          </div>
          <div className="mt-auto flex items-center justify-between border-t-2 border-dashed border-ink/20 pt-3">
            <span className="font-display text-xl font-extrabold">
              {formatINR(c.hourlyRate)}
              <span className="text-sm font-semibold text-ink-mute">/hr</span>
            </span>
            <span className="text-sm font-bold group-hover:underline">View →</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
