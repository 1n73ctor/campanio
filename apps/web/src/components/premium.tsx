'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PremiumKind, PremiumOffer } from '@companio/api-client';
import { CATEGORIES, cityBySlug, formatINR, type CompanionCardDto, type CompanionDetailDto } from '@companio/types';
import { Avatar, Badge, Button, Card, Stars, buttonClass } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { useGatewayPay } from '@/lib/use-gateway-pay';
import { CardPhoto } from './card-photo';
import { MessageHost } from './message-host';
import { ProfileActions } from './profile-actions';
import { useToast } from './toast';

// one fetch per page load for every card on it
let unlockedCache: Promise<Map<string, string | null>> | null = null;
let cacheToken: string | null = null;
const listeners = new Set<() => void>();
const refreshPremium = () => {
  unlockedCache = null;
  listeners.forEach((f) => f());
};

function useUnlocked() {
  const { api, token } = useAuth();
  const [map, setMap] = useState<Map<string, string | null>>(new Map());
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((x) => x + 1);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);
  useEffect(() => {
    if (!token) return setMap(new Map());
    if (!unlockedCache || cacheToken !== token) {
      cacheToken = token;
      unlockedCache = api.premium
        .unlocked()
        .then((rows) => new Map(rows.map((r) => [r.id, r.avatarUrl])))
        .catch(() => new Map());
    }
    unlockedCache.then(setMap);
  }, [api, token, n]);
  return map;
}

let priceCache: Promise<number | null> | null = null;
function useFromPrice() {
  const { api } = useAuth();
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    priceCache ??= api.premium
      .offer()
      .then((o) => o.prices.HOST)
      .catch(() => null);
    priceCache.then(setPrice);
  }, [api]);
  return price;
}

/** Explore card for a ⭐ Premium host: gold, big (blurred until unlocked) photo, the basics in the clear. */
export function PremiumCard({ c }: { c: CompanionCardDto }) {
  const unlocked = useUnlocked();
  const price = useFromPrice();
  const open = unlocked.has(c.id);
  const src = open ? unlocked.get(c.id) : c.avatarUrl;
  const first = c.name.split(' ')[0];
  const cats = c.categories.map((s) => CATEGORIES.find((x) => x.slug === s)).filter(Boolean);
  return (
    <Link href={`/companions/${c.id}`} className="group block focus:outline-none">
      <Card interactive tone="sunny" className="relative flex h-full flex-col overflow-hidden ring-2 ring-sunny ring-offset-2 ring-offset-paper">
        <div className="relative aspect-[16/10] overflow-hidden border-b-3 border-ink sm:aspect-[4/3]">
          <CardPhoto src={src} name={first} categories={c.categories} alt={open ? first : `${first} (locked)`} className={open ? '' : 'scale-110'} noInitial={!open} />
          <span className="absolute left-3 top-3 rounded-full border-2 border-ink bg-sunny px-2.5 py-0.5 text-xs font-extrabold shadow-brutal-sm">⭐ PREMIUM</span>
          {(c.freeToday || c.freeWeekend) && (
            <span className={`absolute right-3 top-3 rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-extrabold ${c.freeToday ? 'bg-lime' : 'bg-sky-soft'}`}>
              {c.freeToday ? '🟢 Free today' : '🗓️ Weekend'}
            </span>
          )}
          {!open && (
            <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-ink/70 via-ink/10 to-transparent p-4 text-center text-white">
              <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-sunny text-xl shadow-brutal-sm">🔒</span>
              <p className="font-display text-lg font-extrabold drop-shadow">Unlock to see {first}</p>
              {price && <p className="text-xs font-semibold opacity-90">from {formatINR(price)}</p>}
            </div>
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
            <span className="ml-auto text-sm text-ink-soft">{cityBySlug(c.city)?.name}</span>
          </div>
          <Stars value={c.ratingAvg} count={c.ratingCount} />
          <p className="line-clamp-2 text-sm font-medium">{c.headline}</p>
          <div className="flex flex-wrap gap-1.5">
            {cats.slice(0, 3).map((cat) => (
              <Badge key={cat!.slug} tone={cat!.color}>
                {cat!.emoji} {cat!.name}
              </Badge>
            ))}
            {c.womenOnly && <Badge tone="pink">👩 Women only</Badge>}
          </div>
          <div className="mt-auto flex items-center justify-between border-t-2 border-dashed border-ink/20 pt-3">
            <span className="font-display text-xl font-extrabold">
              {formatINR(c.hourlyRate)}
              <span className="text-sm font-semibold text-ink-mute">/hr</span>
            </span>
            <span className="text-sm font-bold group-hover:underline">{open ? 'View →' : 'Unlock →'}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

const LABEL: Record<PremiumKind, { title: string; note: string }> = {
  HOST: { title: 'Unlock this host', note: 'See their full profile, book and message them' },
  PASS_30: { title: 'All Premium hosts · 30 days', note: 'Every ⭐ Premium host, including new ones' },
  LIFETIME: { title: 'All Premium hosts · lifetime', note: 'Pay once, unlocked for good' },
};

/** The three ways to unlock, paid by UPI/card or with coins the member bought (never credit or bonus coins). */
export function PremiumUnlock({ hostId, name, onUnlocked }: { hostId: string; name: string; onUnlocked: () => void }) {
  const { api, user } = useAuth();
  const toast = useToast();
  const path = usePathname();
  const { pay, modal } = useGatewayPay('Premium unlock');
  const [offer, setOffer] = useState<PremiumOffer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    api.premium.offer().then(setOffer).catch(() => {});
  }, [api, user?.id]);

  if (!user)
    return (
      <Card tone="sunny" className="space-y-3 p-5">
        <p className="font-display text-lg font-extrabold">⭐ {name} is a Premium host</p>
        <p className="text-sm">Sign in to unlock their full profile, book and message them.</p>
        <Link href={`/login?next=${encodeURIComponent(path ?? '/explore')}`} className={buttonClass('primary', 'lg', 'w-full')}>
          Sign in to unlock
        </Link>
      </Card>
    );
  if (!offer) return null;

  const buy = async (kind: PremiumKind, payWith: 'coins' | 'gateway') => {
    setBusy(`${kind}-${payWith}`);
    try {
      const r = await api.premium.unlock(kind, payWith, kind === 'HOST' ? hostId : undefined);
      if (await pay(r)) {
        toast(kind === 'HOST' ? `${name} unlocked 🎉` : 'All Premium hosts unlocked 🎉');
        refreshPremium();
        onUnlocked();
      }
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const kinds: PremiumKind[] = offer.access.all ? [] : ['HOST', 'PASS_30', 'LIFETIME'];

  return (
    <Card tone="sunny" className="space-y-3 p-5">
      <p className="font-display text-lg font-extrabold">⭐ {name} is a Premium host</p>
      <p className="text-sm">Unlock to see {name}’s photos and full profile, then book or message as usual.</p>
      <p className="text-xs font-semibold">✅ Verified ID · 📸 Real photos · 💬 Book & chat after unlocking</p>
      <div className="space-y-2">
        {kinds.map((k) => {
          const price = offer.prices[k];
          return (
            <div key={k} className={`rounded-chunky border-2 border-ink p-3 ${k === 'PASS_30' ? 'bg-lime-soft shadow-brutal-sm' : 'bg-white'}`}>
              {k === 'PASS_30' && (
                <span className="mb-1 inline-block rounded-full border-2 border-ink bg-lime px-2 py-0.5 text-[11px] font-extrabold">🔥 BEST VALUE</span>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">{LABEL[k].title}</p>
                <p className="font-display text-xl font-extrabold">{formatINR(price)}</p>
              </div>
              <p className="text-xs text-ink-soft">{LABEL[k].note}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" loading={busy === `${k}-gateway`} disabled={!!busy} onClick={() => buy(k, 'gateway')}>
                  Pay by UPI / card
                </Button>
                {offer.paidCoins >= price && (
                  <Button size="sm" variant="white" loading={busy === `${k}-coins`} disabled={!!busy} onClick={() => buy(k, 'coins')}>
                    Use {price} coins
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-ink-soft">
        {offer.paidCoins > 0 ? `You have ${offer.paidCoins} bought coins. ` : ''}Only money you pay or coins you bought can be used — not credit or bonus coins.
      </p>
      {modal}
    </Card>
  );
}

/** Loads the full profile when this member has unlocked the host. */
function useFullHost(id: string) {
  const { api, token } = useAuth();
  const [full, setFull] = useState<CompanionDetailDto | null>(null);
  const [checked, setChecked] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!token) return setChecked(true);
    api.premium
      .host(id)
      .then(setFull)
      .catch(() => setFull(null))
      .finally(() => setChecked(true));
  }, [api, token, id, n]);
  return { full, checked, reload: () => setN((x) => x + 1) };
}

/**
 * A ⭐ Premium host's profile: the page itself only has the blurred version; members who unlocked get the full
 * profile here. Booking and messaging are behind the unlock (the server enforces it too).
 */
export function PremiumHostView({ c, children }: { c: CompanionDetailDto; children: React.ReactNode }) {
  const { full, checked, reload } = useFullHost(c.id);
  const show = full ?? c;
  const first = c.name.split(' ')[0];
  const cats = show.categories.map((s) => CATEGORIES.find((x) => x.slug === s)).filter(Boolean);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card tone="sunny" className="overflow-hidden ring-2 ring-sunny ring-offset-2 ring-offset-paper">
          <div className="flex items-center justify-between gap-2 border-b-3 border-ink bg-sunny px-5 py-2 text-sm font-extrabold">
            <span>⭐ PREMIUM HOST</span>
            {!full && <span className="font-semibold">Verified · hand-picked</span>}
          </div>
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            {full ? (
              <Avatar name={show.name} src={show.avatarUrl} size={112} className="shadow-brutal" />
            ) : (
              <div className="relative aspect-square w-full max-w-[220px] shrink-0 self-center overflow-hidden rounded-blob border-3 border-ink bg-gradient-to-br from-sunny via-pink to-lavender shadow-brutal sm:w-44">
                {c.avatarUrl && <img src={c.avatarUrl} alt={`${first} (locked)`} className="h-full w-full scale-110 object-cover" />}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/20 text-white">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-sunny text-2xl shadow-brutal-sm">🔒</span>
                  <span className="mt-2 text-sm font-extrabold drop-shadow">Unlock to see</span>
                </div>
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-4xl font-extrabold">{first}</h1>
                {show.age && <span className="text-xl font-semibold">{show.age}</span>}
                {show.verified && <Badge tone="lime">✅ ID verified</Badge>}
              </div>
              <p className="mt-1 text-lg font-semibold">{show.headline}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm font-semibold">
                <Stars value={show.ratingAvg} count={show.ratingCount} />
                <span>🗣 {show.languages.join(', ')}</span>
                <span>🤝 {show.completedBookings} meetups</span>
              </div>
              {!full && checked && (
                <a href="#unlock" className={buttonClass('primary', 'md', 'mt-4 lg:hidden')}>
                  🔓 Unlock {first}’s profile
                </a>
              )}
            </div>
          </div>
        </Card>
        {show.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {show.photos.map((p, i) => (
              <img key={p} src={p} alt={`${first} photo ${i + 1}`} className="aspect-square w-full rounded-chunky border-3 border-ink object-cover" />
            ))}
          </div>
        )}
        <Card className="p-6">
          <h2 className="mb-3 text-xl font-extrabold">About {first}</h2>
          {full ? (
            <>
              <p className="whitespace-pre-line text-ink-soft">{full.about}</p>
              {full.bio && <p className="mt-3 text-sm text-ink-mute">{full.bio}</p>}
            </>
          ) : (
            <div className="relative">
              {c.about && (
                <p className="text-ink-soft">{c.about}</p>
              )}
              <div className="mt-2 space-y-2 blur-[2px]" aria-hidden>
                <div className="h-3 w-full rounded-full bg-ink/15" />
                <div className="h-3 w-11/12 rounded-full bg-ink/15" />
                <div className="h-3 w-2/3 rounded-full bg-ink/15" />
              </div>
              <p className="mt-3 rounded-chunky border-2 border-dashed border-ink/40 bg-sunny-soft px-3 py-2 text-sm font-semibold">
                🔒 {first} shared more about themselves — unlock to read it all.
              </p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {cats.map((cat) => (
              <Badge key={cat!.slug} tone={cat!.color} className="px-3 py-1 text-sm">
                {cat!.emoji} {cat!.name}
              </Badge>
            ))}
          </div>
        </Card>
        {children}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card id="unlock" className="scroll-mt-24 space-y-4 p-6">
          <p className="font-display text-3xl font-extrabold">
            {formatINR(c.hourlyRate)}
            <span className="text-base font-semibold text-ink-mute">/hour</span>
          </p>
          {full ? (
            <>
              <Link href={`/book/${c.id}`} className={buttonClass('primary', 'lg', 'w-full')}>
                Request a meetup with {first}
              </Link>
              <MessageHost companionId={c.id} companionUserId={c.userId} name={first} />
            </>
          ) : (
            checked && <PremiumUnlock hostId={c.id} name={first} onUnlocked={reload} />
          )}
          <ul className="space-y-1.5 text-sm">
            <li>🔐 Paid into escrow — released after the meetup</li>
            <li>📍 Public places only · live location & SOS</li>
          </ul>
        </Card>
        <ProfileActions companionUserId={c.userId} name={first} />
      </aside>
    </div>
  );
}
