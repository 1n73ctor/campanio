'use client';

import { useState } from 'react';
import { formatINR } from '@companio/types';
import { Button, Card, Input, cn } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { useGatewayPay } from '@/lib/use-gateway-pay';
import { useToast } from './toast';
import { errMsg } from '@/lib/format';

const PRESETS = [100, 200, 500, 1000];
const MIN = 50;
const MAX = 10_000;

/** Add coins (₹1 = 1 coin) to the wallet. Coins are spend-only: for chats and meetups, never withdrawn. */
export function AddCoins({ onAdded, className, id }: { onAdded: () => void; className?: string; id?: string }) {
  const { api } = useAuth();
  const toast = useToast();
  const { pay, modal } = useGatewayPay('Add coins');
  const [amount, setAmount] = useState('200');
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const ok = Number.isInteger(n) && n >= MIN && n <= MAX;

  const add = async () => {
    setBusy(true);
    try {
      if (await pay(await api.payments.topUp(n))) {
        toast(`${formatINR(n)} coins added 🪙`);
        onAdded();
      }
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id={id} className={cn('p-5', className)}>
      <h2 className="font-display text-lg font-extrabold">🪙 Add coins</h2>
      <p className="mt-1 text-sm text-ink-soft">1 coin = ₹1. Use coins to message hosts or pay for meetups. Coins can’t be withdrawn.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p} size="sm" variant={n === p ? 'primary' : 'white'} onClick={() => setAmount(String(p))}>
            {formatINR(p)}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input type="number" inputMode="numeric" min={MIN} max={MAX} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" aria-label="Amount" />
        <Button loading={busy} disabled={!ok} onClick={add}>
          Add {ok ? formatINR(n) : 'coins'}
        </Button>
      </div>
      {!ok && amount !== '' && <p className="mt-1 text-xs text-danger">Enter {formatINR(MIN)}–{formatINR(MAX)}</p>}
      {modal}
    </Card>
  );
}
