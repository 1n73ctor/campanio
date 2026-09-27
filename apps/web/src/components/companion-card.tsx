import Link from 'next/link';
import type { CompanionCardDto } from '@companio/types';
import { CATEGORIES, cityBySlug, formatINR } from '@companio/types';
import { Avatar, Badge, Card, Stars } from '@companio/ui';

export function CompanionCard({ c }: { c: CompanionCardDto }) {
  const cats = c.categories.map((s) => CATEGORIES.find((x) => x.slug === s)).filter(Boolean);
  return (
    <Link href={`/companions/${c.id}`} className="group block focus:outline-none">
      <Card interactive className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar name={c.name} src={c.avatarUrl} size={60} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-lg font-extrabold">{c.name.split(' ')[0]}</h3>
              {c.age && <span className="text-ink-mute">· {c.age}</span>}
              {c.verified && (
                <span title="ID verified" className="text-sm">
                  ✅
                </span>
              )}
            </div>
            <p className="text-sm text-ink-soft">{cityBySlug(c.city)?.name}</p>
            <Stars value={c.ratingAvg} count={c.ratingCount} />
          </div>
        </div>
        {(c.freeToday || c.freeWeekend || c.womenOnly) && (
          <div className="flex flex-wrap gap-1.5">
            {(c.freeToday || c.freeWeekend) && (
              <span className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-extrabold ${c.freeToday ? 'bg-lime' : 'bg-sky-soft'}`}>
                {c.freeToday ? '🟢 Free today' : '🗓️ Free this weekend'}
              </span>
            )}
            {c.womenOnly && (
              <span title="Only accepts bookings from women" className="rounded-full border-2 border-ink bg-pink-soft px-2.5 py-0.5 text-xs font-extrabold">
                👩 Women only
              </span>
            )}
          </div>
        )}
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium">{c.headline}</p>
        <div className="flex flex-wrap gap-1.5">
          {cats.slice(0, 3).map((cat) => (
            <Badge key={cat!.slug} tone={cat!.color}>
              {cat!.emoji} {cat!.name}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between border-t-2 border-dashed border-ink/20 pt-3">
          <span className="font-display text-xl font-extrabold">
            {formatINR(c.hourlyRate)}
            <span className="text-sm font-semibold text-ink-mute">/hr</span>
          </span>
          <span className="text-sm font-bold group-hover:underline">View →</span>
        </div>
      </Card>
    </Link>
  );
}
