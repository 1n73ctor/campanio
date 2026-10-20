'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR, type TopUpRequestDto, type TopUpStartDto } from '@companio/types';
import { Button, Card, Coin, Field, Input, Modal, cn } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { useGatewayPay } from '@/lib/use-gateway-pay';
import { useToast } from './toast';
import { errMsg, fmtDateTime } from '@/lib/format';

const PRESETS = [100, 200, 500, 1000];
const MIN = 50;
const MAX = 10_000;

/**
 * Add coins (₹1 = 1 coin) to the wallet. Coins are spend-only: for chats and meetups, never withdrawn.
 * Until the payment gateway is live, coins are bought by paying the UPI QR; an admin checks and approves each payment.
 */
export function AddCoins({ onAdded, className, id }: { onAdded: () => void; className?: string; id?: string }) {
  const { api } = useAuth();
  const toast = useToast();
  const { pay, modal } = useGatewayPay('Add coins');
  const [mode, setMode] = useState<{ manual: boolean; payeeName: string | null } | null>(null);
  const [amount, setAmount] = useState('200');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<TopUpStartDto | null>(null);
  const [requests, setRequests] = useState<TopUpRequestDto[]>([]);
  const n = Number(amount);
  const ok = Number.isInteger(n) && n >= MIN && n <= MAX;

  const loadRequests = useCallback(() => api.topups.mine().then(setRequests).catch(() => {}), [api]);
  useEffect(() => {
    api.topups.mode().then(setMode).catch(() => setMode({ manual: false, payeeName: null }));
    loadRequests();
  }, [api, loadRequests]);

  const add = async () => {
    setBusy(true);
    try {
      if (mode?.manual) setQr(await api.topups.start(n));
      else if (await pay(await api.payments.topUp(n))) {
        toast(`${n.toLocaleString('en-IN')} coins added`);
        onAdded();
      }
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!mode) return null;
  const open = requests.filter((r) => r.status === 'STARTED' || r.status === 'PENDING');
  const recent = requests.filter((r) => r.status !== 'STARTED').slice(0, 5);

  return (
    <Card id={id} className={cn('p-5', className)}>
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
        <Coin size={26} /> Add coins
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        1 coin = ₹1. Use coins to message hosts or pay for meetups. Coins can’t be withdrawn.
        {mode.manual && ' Pay by UPI — we add the coins as soon as we’ve checked your payment.'}
      </p>
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
          {mode.manual ? `Pay ${ok ? formatINR(n) : ''} by UPI` : `Add ${ok ? formatINR(n) : 'coins'}`}
        </Button>
      </div>
      {!ok && amount !== '' && <p className="mt-1 text-xs text-danger">Enter {formatINR(MIN)}–{formatINR(MAX)}</p>}

      {(open.length > 0 || recent.length > 0) && (
        <div className="mt-5 border-t-2 border-dashed border-ink/15 pt-4">
          <h3 className="font-display font-extrabold">Your coin top-ups</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {[...open, ...recent.filter((r) => !open.includes(r))].map((r) => (
              <TopUpRow key={r.id} r={r} onChange={() => (loadRequests(), onAdded())} />
            ))}
          </ul>
        </div>
      )}

      {qr && (
        <PayByUpi
          request={qr}
          onClose={() => {
            setQr(null);
            loadRequests();
          }}
        />
      )}
      {modal}
    </Card>
  );
}

function TopUpRow({ r, onChange }: { r: TopUpRequestDto; onChange: () => void }) {
  const { api } = useAuth();
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const label =
    r.status === 'PENDING'
      ? '⏳ Checking your payment'
      : r.status === 'APPROVED'
        ? `✅ ${r.credited?.toLocaleString('en-IN')} coins added`
        : r.status === 'REJECTED'
          ? `❌ Not added${r.reviewNote ? ` — ${r.reviewNote}` : ''}`
          : 'Not paid yet';
  return (
    <li className="rounded-chunky border-2 border-ink/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <b>{formatINR(r.amount)}</b> · <span className="font-mono">{r.ref}</span> · <span className="text-ink-soft">{fmtDateTime(r.createdAt)}</span>
        </span>
        <span className="font-semibold">{label}</span>
      </div>
      {r.status === 'STARTED' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setPaying(true)}>I’ve paid</Button>
          <Button
            size="sm"
            variant="white"
            onClick={async () => {
              try {
                await api.topups.cancel(r.id);
                onChange();
              } catch (e) {
                toast(errMsg(e), 'error');
              }
            }}
          >
            Cancel
          </Button>
        </div>
      )}
      {paying && <PaidForm request={r} onDone={() => (setPaying(false), onChange())} onClose={() => setPaying(false)} />}
    </li>
  );
}

/** QR (amount + note filled in), the note to write, a button for phones, then "I've paid". */
export function PayByUpi({ request: r, onClose }: { request: TopUpStartDto; onClose: () => void }) {
  const toast = useToast();
  const phone = typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent);
  const [step, setStep] = useState<'pay' | 'paid'>('pay');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.note);
      toast('Note copied');
    } catch {
      toast('Copy didn’t work — type the note in yourself', 'error');
    }
  };
  if (step === 'paid') return <PaidForm request={r} onDone={onClose} onClose={onClose} />;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Pay ${formatINR(r.amount)} by UPI`}
      footer={
        <Button className="w-full" onClick={() => setStep('paid')}>
          I’ve paid {formatINR(r.amount)}
        </Button>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.qr} alt={`UPI QR to pay ${formatINR(r.amount)}`} width={240} height={240} className="rounded-chunky border-3 border-ink" />
        </div>
        <p className="text-center">
          Paying <b>{r.payeeName}</b> · <b>{formatINR(r.amount)}</b>
        </p>
        {phone && (
          <a href={r.upiLink} className="block">
            <Button variant="lime" className="w-full">Open my UPI app</Button>
          </a>
        )}
        <div className="rounded-chunky border-3 border-ink bg-sunny p-3">
          <p className="font-bold">Important: write this in the payment note</p>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border-2 border-ink bg-white px-3 py-2">
            <span className="font-mono text-base font-bold">{r.note}</span>
            <Button size="sm" variant="white" onClick={copy}>Copy</Button>
          </div>
          <p className="mt-2 text-xs">It’s how we know the payment is yours. Without it, adding your coins can take much longer.</p>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
          <li>{phone ? 'Tap “Open my UPI app”, or scan' : 'Scan'} the QR with PhonePe, Google Pay, Paytm or any UPI app.</li>
          <li>Check the amount is {formatINR(r.amount)} and the note says “{r.note}”.</li>
          <li>Pay, then tap “I’ve paid”. We usually add coins within a few hours.</li>
        </ol>
      </div>
    </Modal>
  );
}

export function PaidForm({ request: r, onDone, onClose }: { request: TopUpRequestDto; onDone: () => void; onClose: () => void }) {
  const { api } = useAuth();
  const toast = useToast();
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = utr.replace(/\s+/g, '');
  const utrOk = !clean || /^\d{12}$/.test(clean);
  const submit = async () => {
    setBusy(true);
    try {
      await api.topups.paid(r.id, clean || undefined);
      toast('Thanks! We’ll add your coins as soon as we’ve checked the payment.');
      onDone();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Payment done?"
      footer={
        <Button className="w-full" loading={busy} disabled={!utrOk} onClick={submit}>
          Send for checking
        </Button>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          We’ll match your {formatINR(r.amount)} payment with the note <b className="font-mono">{r.note}</b> and add the coins to your wallet.
        </p>
        <Field label="UPI transaction ID (optional)" hint="12 digits — in your UPI app’s payment details (also called UTR or reference no.). It helps us find your payment faster." error={utrOk ? null : 'The transaction ID is 12 digits'}>
          <Input inputMode="numeric" value={utr} maxLength={20} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 412345678901" />
        </Field>
      </div>
    </Modal>
  );
}
