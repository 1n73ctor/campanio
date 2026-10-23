'use client';

import { useEffect, useState } from 'react';
import { formatINR, type TopUpOfferDto } from '@companio/types';
import { Button, Card, Coin, Input, cn } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { useGatewayPay } from '@/lib/use-gateway-pay';
import { useToast } from './toast';
import { errMsg } from '@/lib/format';

const PRESETS = [100, 200, 500, 1000];
const MIN = 50;
const MAX = 10_000;

/** The best bonus for an amount — for display only; the server works out the real one when the payment starts. */
function bestBonus(offers: TopUpOfferDto[], amount: number) {
  let best: { bonus: number; offer: TopUpOfferDto } | null = null;
  for (const o of offers) {
    if (amount < o.minAmount) continue;
    const bonus = Math.min(Math.floor((amount * o.bonusPct) / 100), o.maxBonus ?? Infinity);
    if (bonus > 0 && (!best || bonus > best.bonus)) best = { bonus, offer: o };
  }
  return best;
}

/**
 * Add coins (₹1 = 1 coin) to the wallet, paid online (UPI, card, netbanking) and added as soon as the payment
 * succeeds — plus bonus coins when an offer applies. Coins are spend-only: for chats and meetups, never withdrawn.
 */
export function AddCoins({ onAdded, className, id }: { onAdded: () => void; className?: string; id?: string }) {
  const { api } = useAuth();
  const toast = useToast();
  const { pay, modal } = useGatewayPay('Add coins');
  const [amount, setAmount] = useState('200');
  const [busy, setBusy] = useState(false);
  const [offers, setOffers] = useState<TopUpOfferDto[]>([]);
  const n = Number(amount);
  const ok = Number.isInteger(n) && n >= MIN && n <= MAX;
  const best = ok ? bestBonus(offers, n) : null;
  const presets = [...new Set([...PRESETS, ...offers.map((o) => o.minAmount)])].filter((p) => p >= MIN && p <= MAX).sort((a, b) => a - b);

  const loadOffers = () => api.payments.topUpOffers().then(setOffers).catch(() => {});
  useEffect(() => {
    void loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const add = async () => {
    setBusy(true);
    try {
      if (await pay(await api.payments.topUp(n))) {
        toast(best ? `${(n + best.bonus).toLocaleString('en-IN')} coins added (incl. ${best.bonus} bonus) 🎉` : `${n.toLocaleString('en-IN')} coins added`);
        onAdded();
        void loadOffers(); // a first-top-up offer no longer applies
      }
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id={id} className={cn('p-5', className)}>
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
        <Coin size={26} /> Add coins
      </h2>
      <p className="mt-1 text-sm text-ink-soft">1 coin = ₹1. Use coins to message hosts or pay for meetups. Coins can’t be withdrawn.</p>

      {offers.length > 0 && (
        <div className="mt-3 rounded-chunky border-2 border-ink bg-sunny-soft p-3">
          <p className="text-sm font-extrabold">🎁 Bonus coins</p>
          <ul className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
            {offers.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setAmount(String(Math.max(o.minAmount, MIN)))} className="rounded-full border-2 border-ink bg-white px-2.5 py-1 hover:bg-lime-soft">
                  {o.firstOnly ? 'First top-up' : `${formatINR(o.minAmount)}+`}: +{o.bonusPct}%{o.maxBonus ? ` (up to ${o.maxBonus})` : ''}
                  {o.firstOnly && o.minAmount > MIN ? ` on ${formatINR(o.minAmount)}+` : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => {
          const b = bestBonus(offers, p);
          return (
            <Button key={p} size="sm" variant={n === p ? 'primary' : 'white'} onClick={() => setAmount(String(p))}>
              {formatINR(p)}
              {b && <span className="ml-1 rounded-full bg-lime px-1.5 text-[11px] font-extrabold text-ink">+{b.bonus}</span>}
            </Button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input type="number" inputMode="numeric" min={MIN} max={MAX} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" aria-label="Amount" />
        <Button loading={busy} disabled={!ok} onClick={add}>
          Add {ok ? formatINR(n) : 'coins'}
        </Button>
      </div>
      {!ok && amount !== '' && <p className="mt-1 text-xs text-danger">Enter {formatINR(MIN)}–{formatINR(MAX)}</p>}
      {ok && (
        <p className="mt-2 text-sm">
          You’ll get <b className="font-display text-base">{(n + (best?.bonus ?? 0)).toLocaleString('en-IN')} coins</b>
          {best && (
            <span className="text-ink-soft">
              {' '}
              ({n.toLocaleString('en-IN')} + <b className="text-ink">{best.bonus} bonus</b> · {best.offer.title})
            </span>
          )}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-mute">UPI · Cards · Netbanking · secured by Razorpay</p>
      {modal}
    </Card>
  );
}
