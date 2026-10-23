'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { TopUpOfferDto } from '@companio/types';
import { Button, Callout, Card, Field, Input, Modal, Select, Stat, Toggle, cn } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { dtIST, formatINR } from '@/admin/lib/format';

type Draft = { id?: string; title: string; minAmount: string; bonusPct: string; maxBonus: string; firstOnly: boolean; startsAt: string; endsAt: string; active: boolean };
const EMPTY: Draft = { title: '', minAmount: '500', bonusPct: '10', maxBonus: '', firstOnly: false, startsAt: '', endsAt: '', active: true };

/** What we suggest: a welcome bonus to get the first top-up, then bigger bonuses for bigger top-ups (all start off). */
const SUGGESTED = [
  { title: 'Welcome bonus', minAmount: 100, bonusPct: 20, maxBonus: 100, firstOnly: true },
  { title: 'Bonus coins', minAmount: 500, bonusPct: 5, maxBonus: null, firstOnly: false },
  { title: 'Bigger bonus', minAmount: 1000, bonusPct: 10, maxBonus: null, firstOnly: false },
  { title: 'Best value', minAmount: 2000, bonusPct: 15, maxBonus: 500, firstOnly: false },
];

// <input type="datetime-local"> works in local time; the API stores ISO
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const bonusFor = (o: { bonusPct: number; maxBonus: number | null }, amount: number) => Math.min(Math.floor((amount * o.bonusPct) / 100), o.maxBonus ?? Infinity);

function offerState(o: TopUpOfferDto) {
  const now = Date.now();
  if (!o.active) return { label: 'Off', tone: 'bg-paper-deep' };
  if (o.startsAt && new Date(o.startsAt).getTime() > now) return { label: 'Scheduled', tone: 'bg-sky' };
  if (o.endsAt && new Date(o.endsAt).getTime() <= now) return { label: 'Ended', tone: 'bg-paper-deep' };
  return { label: 'Live', tone: 'bg-lime' };
}

/** Who added money to their wallet (Razorpay), how much, the bonus they got — and the bonus offers. */
export default function CoinPurchasesPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const [tab, setTab] = useState<'purchases' | 'offers'>('purchases');
  const [status, setStatus] = useState('paid');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data: sum } = useLoad(() => api.admin.coinSummary(), []);
  const { data: rows, error } = useLoad(() => api.admin.coinPurchases({ page, status, q: search || undefined }), [page, status, search]);
  const { data: offers, reload: reloadOffers } = useLoad(() => api.admin.topUpOffers(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await api.admin.saveTopUpOffer({
        id: draft.id,
        title: draft.title.trim(),
        minAmount: Number(draft.minAmount),
        bonusPct: Number(draft.bonusPct),
        maxBonus: draft.maxBonus ? Number(draft.maxBonus) : null,
        firstOnly: draft.firstOnly,
        startsAt: fromLocal(draft.startsAt),
        endsAt: fromLocal(draft.endsAt),
        active: draft.active,
      });
      toast('Offer saved — members see it in Wallet → Add coins');
      setDraft(null);
      reloadOffers();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const quick = async (o: TopUpOfferDto, patch: Partial<TopUpOfferDto>) => {
    try {
      await api.admin.saveTopUpOffer({ ...o, ...patch });
      reloadOffers();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const addSuggested = async () => {
    setBusy(true);
    try {
      for (const s of SUGGESTED) await api.admin.saveTopUpOffer({ ...s, active: false });
      toast('Added 4 suggested offers (switched off) — switch on the ones you want');
      reloadOffers();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const pct = Number(draft?.bonusPct) || 0;
  const draftOk = !!draft && draft.title.trim().length >= 2 && Number(draft.minAmount) >= 50 && pct >= 1 && pct <= 50 && (!draft.maxBonus || Number(draft.maxBonus) >= 1);

  return (
    <>
      <PageTitle title="🪙 Coin purchases" subtitle="Who added money to their wallet, how much, and the bonus coins they got. Set bonus offers to get people to load more." />

      {sum && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(
            [
              ['Today', sum.today, 'lime'],
              ['Last 7 days', sum.week, 'sky'],
              ['Last 30 days', sum.month, 'white'],
              ['All time', sum.allTime, 'sunny'],
            ] as const
          ).map(([label, s, tone]) => (
            <Stat
              key={label}
              label={label}
              tone={tone}
              value={formatINR(s.amount)}
              hint={
                <>
                  {s.count} purchase{s.count === 1 ? '' : 's'}
                  {s.bonus > 0 && ` · ${s.bonus.toLocaleString('en-IN')} bonus coins`}
                  {'buyers' in s && ` · ${s.buyers} people`}
                </>
              }
            />
          ))}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={tab === 'purchases' ? 'primary' : 'white'} onClick={() => setTab('purchases')}>
          Purchases
        </Button>
        <Button size="sm" variant={tab === 'offers' ? 'primary' : 'white'} onClick={() => setTab('offers')}>
          Offers ({offers?.filter((o) => offerState(o).label === 'Live').length ?? 0} live)
        </Button>
      </div>

      {tab === 'purchases' ? (
        <>
          <form
            className="mb-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(q.trim());
            }}
          >
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or email" className="max-w-xs" aria-label="Search" />
            <Button type="submit" variant="white">
              Search
            </Button>
            <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="max-w-48" aria-label="Show">
              <option value="paid">Paid</option>
              <option value="unpaid">Started, not paid</option>
              <option value="all">All</option>
            </Select>
          </form>
          {error ? (
            <ErrorBox error={error} />
          ) : !rows ? (
            <Loading />
          ) : (
            <>
              <Table head={['When (IST)', 'Member', 'Paid', 'Bonus', 'Coins received', 'Status', 'Payment ID']} empty={rows.items.length === 0}>
                {rows.items.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap text-xs">{dtIST(p.createdAt)}</Td>
                    <Td>
                      <Link href={`/admin/users/${p.user.id}`} className="font-semibold underline">
                        {p.user.name ?? 'Member'}
                      </Link>
                      <p className="text-xs text-ink-mute">{p.user.phone}</p>
                    </Td>
                    <Td className="font-semibold tabular-nums">{formatINR(p.amount)}</Td>
                    <Td className="text-sm">
                      {p.bonus > 0 ? (
                        <>
                          <b>+{p.bonus}</b>
                          <p className="text-xs text-ink-mute">{p.offerTitle}</p>
                        </>
                      ) : (
                        <span className="text-ink-mute">—</span>
                      )}
                    </Td>
                    <Td className="tabular-nums">{p.status === 'PAID' ? (p.amount + p.bonus).toLocaleString('en-IN') : '—'}</Td>
                    <Td>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', p.status === 'PAID' ? 'bg-lime' : p.status === 'FAILED' ? 'bg-pink' : 'bg-paper-deep')}>
                        {p.status === 'PAID' ? 'Paid' : p.status === 'FAILED' ? 'Failed' : 'Not paid'}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs">{p.providerPaymentId ?? '—'}</Td>
                  </tr>
                ))}
              </Table>
              <Pager page={rows.page} total={rows.total} pageSize={rows.pageSize} onPage={setPage} />
            </>
          )}
        </>
      ) : (
        <>
          <Callout tone="sky" title="💡 How offers work" className="mb-4">
            Members get <b>extra coins</b> on top of what they pay (pay {formatINR(1000)} → 1,100 coins at +10%). Bonus coins are spend-only, so they only cost you when used on a
            meetup or chat, and can never be withdrawn. If several offers apply, the member gets the biggest bonus. Start with a welcome bonus for the first top-up and
            bigger bonuses for bigger top-ups — that’s what gets people to load more.
          </Callout>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={() => setDraft({ ...EMPTY })}>+ New offer</Button>
            {offers && offers.length === 0 && (
              <Button variant="white" loading={busy} onClick={addSuggested}>
                ✨ Add suggested offers
              </Button>
            )}
          </div>
          {!offers ? (
            <Loading />
          ) : offers.length === 0 ? (
            <Card className="p-5 text-sm text-ink-soft">
              No offers yet. Suggested setup: <b>Welcome bonus</b> +20% on the first top-up (up to 100 coins), <b>+5%</b> on {formatINR(500)}+, <b>+10%</b> on{' '}
              {formatINR(1000)}+, <b>+15%</b> on {formatINR(2000)}+ (up to 500 coins).
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {offers.map((o) => {
                const st = offerState(o);
                return (
                  <Card key={o.id} className={cn('p-4 text-sm', st.label !== 'Live' && 'opacity-75')}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-lg font-extrabold">{o.title}</p>
                        <p>
                          <b>+{o.bonusPct}%</b> coins on {formatINR(o.minAmount)}+{o.maxBonus ? ` · up to ${o.maxBonus} coins` : ''}
                          {o.firstOnly && ' · first top-up only'}
                        </p>
                        <p className="mt-1 text-xs text-ink-mute">
                          e.g. pay {formatINR(Math.max(o.minAmount, 1000))} → {(Math.max(o.minAmount, 1000) + bonusFor(o, Math.max(o.minAmount, 1000))).toLocaleString('en-IN')} coins
                          {(o.startsAt || o.endsAt) && ` · ${o.startsAt ? `from ${dtIST(o.startsAt)}` : ''}${o.endsAt ? ` until ${dtIST(o.endsAt)}` : ''}`}
                        </p>
                      </div>
                      <span className={cn('rounded-full border-2 border-ink px-2 py-0.5 text-xs font-bold', st.tone)}>{st.label}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Toggle checked={o.active} onChange={(v) => quick(o, { active: v })} label="On" />
                      <Button
                        size="sm"
                        variant="white"
                        onClick={() =>
                          setDraft({
                            id: o.id,
                            title: o.title,
                            minAmount: String(o.minAmount),
                            bonusPct: String(o.bonusPct),
                            maxBonus: o.maxBonus ? String(o.maxBonus) : '',
                            firstOnly: o.firstOnly,
                            startsAt: toLocal(o.startsAt),
                            endsAt: toLocal(o.endsAt),
                            active: o.active,
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="white"
                        onClick={async () => {
                          if (!confirm(`Delete “${o.title}”?`)) return;
                          await api.admin.deleteTopUpOffer(o.id).catch((e) => toast(errMsg(e), 'error'));
                          reloadOffers();
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit offer' : 'New offer'}
        footer={
          <Button loading={busy} disabled={!draftOk} onClick={save}>
            Save offer
          </Button>
        }
      >
        {draft && (
          <div className="space-y-3">
            <Field label="Name members see">
              <Input value={draft.title} maxLength={60} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Diwali bonus" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Top-up of at least (₹)">
                <Input type="number" min={50} value={draft.minAmount} onChange={(e) => setDraft({ ...draft, minAmount: e.target.value })} />
              </Field>
              <Field label="Extra coins (%)" hint="1–50">
                <Input type="number" min={1} max={50} value={draft.bonusPct} onChange={(e) => setDraft({ ...draft, bonusPct: e.target.value })} />
              </Field>
              <Field label="Max extra coins" hint="empty = no cap">
                <Input type="number" min={1} value={draft.maxBonus} onChange={(e) => setDraft({ ...draft, maxBonus: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts (optional)">
                <Input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
              </Field>
              <Field label="Ends (optional)">
                <Input type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Toggle checked={draft.firstOnly} onChange={(v) => setDraft({ ...draft, firstOnly: v })} label="First top-up only" />
              <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="On" />
            </div>
            {draftOk && (
              <Callout tone="lime">
                Pay {formatINR(Math.max(Number(draft.minAmount), 1000))} → get{' '}
                <b>
                  {(
                    Math.max(Number(draft.minAmount), 1000) +
                    bonusFor({ bonusPct: pct, maxBonus: draft.maxBonus ? Number(draft.maxBonus) : null }, Math.max(Number(draft.minAmount), 1000))
                  ).toLocaleString('en-IN')}{' '}
                  coins
                </b>
                {draft.firstOnly && ' (first top-up only)'}
              </Callout>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
