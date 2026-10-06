'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CATEGORIES, MAX_BOOKING_HOURS, WEEKDAYS, cityBySlug, formatINR, type CompanionDetailDto, type QuoteDto } from '@companio/types';
import { Avatar, Button, Callout, Card, Field, Input, Select, Stars, Textarea } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader } from '@/components/misc';
import { errMsg, todayIST } from '@/lib/format';
import { track } from '@/lib/analytics';

const TIMES = Array.from({ length: 36 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});
const label12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export default function BookPage({ params }: { params: Promise<{ companionId: string }> }) {
  const { companionId } = use(params);
  const user = useRequireAuth();
  const { api } = useAuth();
  const router = useRouter();
  const [c, setC] = useState<CompanionDetailDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [form, setForm] = useState({ category: '', date: '', time: '', hours: 2, meetingPoint: '', note: '' });
  const [quote, setQuote] = useState<QuoteDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.companions
      .get(companionId)
      .then((d) => {
        setC(d);
        setForm((f) => ({ ...f, category: d.categories[0] ?? '' }));
      })
      .catch((e) => setLoadErr(errMsg(e)));
  }, [api, companionId]);

  useEffect(() => {
    api.bookings.quote(companionId, form.hours).then(setQuote).catch(() => setQuote(null));
  }, [api, companionId, form.hours]);

  // time slots that fall inside the companion's availability for the chosen weekday
  const slots = useMemo(() => {
    if (!c || !form.date) return TIMES;
    const avail = c.availability;
    if (!Object.values(avail).some((s) => s?.length)) return TIMES;
    const d = new Date(`${form.date}T12:00:00+05:30`);
    const day = WEEKDAYS[(d.getUTCDay() + 6) % 7];
    const endOf = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      const e = h * 60 + m + form.hours * 60;
      return e >= 24 * 60 ? '24:00' : `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
    };
    return TIMES.filter((t) => (avail[day] ?? []).some((s) => s.from <= t && endOf(t) <= s.to));
  }, [c, form.date, form.hours]);

  if (loadErr) return <div className="container-x py-16 text-center font-semibold">{loadErr}</div>;
  if (!user || !c) return <FullLoader />;
  const first = c.name.split(' ')[0];
  if (c.womenOnly && user.gender !== 'FEMALE') {
    return (
      <div className="container-x max-w-xl py-16">
        <Callout tone="pink" title={`${first} only accepts meetups from women`}>
          {first} has chosen to meet women members only, for their safety. There are plenty of other verified hosts to explore.
        </Callout>
        <Link href="/explore" className="mt-4 inline-block font-semibold underline">
          ← Explore other hosts
        </Link>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const b = await api.bookings.create({
        companionId,
        category: form.category,
        startAt: new Date(`${form.date}T${form.time}:00+05:30`).toISOString(),
        hours: form.hours,
        meetingPoint: form.meetingPoint.trim(),
        note: form.note.trim() || undefined,
      });
      track({ name: 'begin_checkout', value: b.total, bookingId: b.id, category: b.category });
      router.push(`/checkout/${b.id}`);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="container-x max-w-5xl py-8">
      <Link href={`/companions/${c.id}`} className="text-sm font-semibold underline">
        ← Back to {first}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">Meet {first}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="space-y-5 p-6">
          <Field label="Activity">
            <div className="flex flex-wrap gap-2">
              {c.categories.map((s) => {
                const cat = CATEGORIES.find((x) => x.slug === s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, category: s })}
                    className={`rounded-full border-3 border-ink px-4 py-2 text-sm font-bold ${form.category === s ? 'bg-ink text-paper' : 'bg-white shadow-brutal-sm'}`}
                  >
                    {cat?.emoji} {cat?.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date">
              <Input type="date" min={todayIST()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, time: '' })} required />
            </Field>
            <Field label="Start time (IST)" hint={form.date && !slots.length ? `${first} isn’t available that day` : undefined}>
              <Select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} disabled={!form.date || !slots.length} required>
                <option value="">Choose</option>
                {slots.map((t) => (
                  <option key={t} value={t}>
                    {label12(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duration">
              <Select value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value), time: '' })}>
                {Array.from({ length: MAX_BOOKING_HOURS }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {h} hour{h > 1 ? 's' : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Meeting point" hint="A public place — café, mall entrance, gym, monument gate. Never a home or hotel room.">
            <Input value={form.meetingPoint} onChange={(e) => setForm({ ...form, meetingPoint: e.target.value })} placeholder={`e.g. Café Coffee Day, ${cityBySlug(c.city)?.name}`} maxLength={200} />
          </Field>
          <Field label={`Note for ${first} (optional)`}>
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} placeholder="What would you like to do? Any preferences?" />
          </Field>
          <Callout tone="lime" title="Keep it safe & platonic">
            Meet in public. Your session starts only when you share your 4-digit code in person. Live location & SOS are on your booking page.
          </Callout>
          {error && <p className="font-semibold text-danger">{error}</p>}
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card tone="pink" className="flex items-center gap-3 p-4">
            <Avatar name={c.name} src={c.avatarUrl} size={56} />
            <div>
              <p className="font-display text-lg font-extrabold">{first} {c.verified && '✅'}</p>
              <Stars value={c.ratingAvg} count={c.ratingCount} />
            </div>
          </Card>
          <Card className="space-y-2 p-5 text-sm">
            <h2 className="mb-2 font-display text-lg font-extrabold">Price breakdown</h2>
            {quote ? (
              <>
                <Row label={`${formatINR(quote.hourlyRate)} × ${quote.hours}h`} value={formatINR(quote.subtotal)} />
                <Row label="Connection fee" value={formatINR(quote.connectionFee)} hint="Covers verification, escrow & 24/7 safety" />
                <Row label={`GST (${quote.gstPct ?? 18}%)`} value={formatINR(quote.gst)} />
                <div className="!mt-3 flex justify-between border-t-3 border-ink pt-3 font-display text-lg font-extrabold">
                  <span>Total</span>
                  <span>{formatINR(quote.total)}</span>
                </div>
              </>
            ) : (
              <p className="text-ink-mute">Calculating…</p>
            )}
          </Card>
          <Button size="lg" className="w-full" loading={busy} disabled={!form.category || !form.date || !form.time || form.meetingPoint.trim().length < 4} onClick={submit}>
            Continue to payment →
          </Button>
          <p className="text-center text-xs text-ink-mute">Full refund if {first} declines or doesn’t respond.</p>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>
        {label}
        {hint && <span className="block text-xs text-ink-mute">{hint}</span>}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
