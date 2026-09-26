'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOOKING_STATUS_LABEL, CATEGORIES, formatINR, type BookingDto, type CheckoutResponse } from '@companio/types';
import { Avatar, Button, Callout, Card, Modal, Toggle } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader } from '@/components/misc';
import { useToast } from '@/components/toast';
import { errMsg, fmtDateTime } from '@/lib/format';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

const loadRazorpay = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(s);
  });

export default function CheckoutPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const user = useRequireAuth();
  const { api } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [b, setB] = useState<BookingDto | null>(null);
  const [balance, setBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState<Extract<CheckoutResponse, { provider: 'mock' }> | null>(null);
  const [method, setMethod] = useState<'upi' | 'card'>('upi');

  useEffect(() => {
    if (!user) return;
    Promise.all([api.bookings.get(bookingId), api.wallet.get()])
      .then(([bk, w]) => {
        if (bk.status !== 'PENDING_PAYMENT') router.replace(`/bookings/${bk.id}`);
        setB(bk);
        setBalance(w.balance);
      })
      .catch((e) => toast(errMsg(e), 'error'));
  }, [user, api, bookingId, router, toast]);

  if (!user || !b) return <FullLoader />;
  const walletUse = useWallet ? Math.min(balance, b.total) : 0;
  const cat = CATEGORIES.find((c) => c.slug === b.category);

  const done = () => {
    toast('Payment successful! 🎉 Request sent.');
    router.replace(`/bookings/${b.id}?paid=1`);
  };

  const pay = async () => {
    setBusy(true);
    try {
      const r = await api.payments.checkout(b.id, useWallet);
      if (r.status === 'PAID') return done();
      if (r.provider === 'mock') {
        setMock(r);
        setBusy(false);
        return;
      }
      await loadRazorpay();
      const rz = new window.Razorpay!({
        key: r.keyId,
        order_id: r.orderId,
        amount: r.amount * 100,
        currency: 'INR',
        name: 'Companio',
        description: `${cat?.name} with ${b.companion.name}`,
        prefill: { contact: user.phone ?? undefined, name: user.name ?? undefined },
        theme: { color: '#FF7AC6' },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await api.payments.verify({ orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature });
            done();
          } catch (e) {
            toast(errMsg(e), 'error');
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.open();
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  const mockPay = async () => {
    if (!mock) return;
    setBusy(true);
    try {
      const sig = await api.payments.mockPay(mock.orderId);
      await api.payments.verify(sig);
      done();
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold">Checkout</h1>
      <p className="mt-1 text-ink-soft">{BOOKING_STATUS_LABEL[b.status]} · complete within 30 minutes to hold the slot.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px]">
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <Avatar name={b.companion.name} src={b.companion.avatarUrl} size={56} />
            <div>
              <p className="font-display text-lg font-extrabold">
                {cat?.emoji} {cat?.name} with {b.companion.name?.split(' ')[0]}
              </p>
              <p className="text-sm text-ink-soft">
                {fmtDateTime(b.startAt)} · {b.hours}h
              </p>
              <p className="text-sm text-ink-soft">📍 {b.meetingPoint}</p>
            </div>
          </div>
          <div className="space-y-2 border-t-2 border-dashed border-ink/20 pt-4 text-sm">
            <Line l={`${formatINR(b.hourlyRate)} × ${b.hours}h`} r={formatINR(b.subtotal)} />
            <Line l="Connection fee" r={formatINR(b.connectionFee)} />
            <Line l="GST" r={formatINR(b.gst)} />
            {walletUse > 0 && <Line l="Wallet credit" r={`− ${formatINR(walletUse)}`} />}
            <div className="flex justify-between border-t-3 border-ink pt-3 font-display text-xl font-extrabold">
              <span>To pay</span>
              <span>{formatINR(b.total - walletUse)}</span>
            </div>
          </div>
          <Callout tone="sky" title="🔐 Held in escrow">
            Your money is released to {b.companion.name?.split(' ')[0]} only after the meetup. Declined, expired or no-show = automatic refund to your wallet.
          </Callout>
        </Card>
        <div className="space-y-4">
          <Card tone="lime" className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-bold">Use wallet</p>
              <p className="text-xs">Balance {formatINR(balance)}</p>
            </div>
            <Toggle checked={useWallet} onChange={setUseWallet} disabled={balance === 0} label="Use wallet balance" />
          </Card>
          <Button size="lg" className="w-full" loading={busy} onClick={pay}>
            Pay {formatINR(b.total - walletUse)}
          </Button>
          <p className="text-center text-xs text-ink-mute">UPI · Cards · Netbanking · Wallet</p>
        </div>
      </div>

      <Modal open={!!mock} onClose={() => setMock(null)} title="Test payment gateway">
        <Callout tone="lavender">This is the local mock gateway (PAYMENT_PROVIDER=mock). No real money moves.</Callout>
        <div className="flex gap-2">
          {(['upi', 'card'] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)} className={`flex-1 rounded-chunky border-3 border-ink py-3 font-bold ${method === m ? 'bg-ink text-paper' : 'bg-white'}`}>
              {m === 'upi' ? '📱 UPI' : '💳 Card'}
            </button>
          ))}
        </div>
        <p className="rounded-chunky border-2 border-dashed border-ink/30 p-3 text-sm">{method === 'upi' ? 'UPI intent → test@okaxis' : 'Card •••• 4242 · 12/30'}</p>
        <Button size="lg" className="w-full" loading={busy} onClick={mockPay}>
          Pay {formatINR(mock?.amount ?? 0)}
        </Button>
      </Modal>
    </div>
  );
}

const Line = ({ l, r }: { l: string; r: string }) => (
  <div className="flex justify-between">
    <span>{l}</span>
    <span className="font-semibold tabular-nums">{r}</span>
  </div>
);
