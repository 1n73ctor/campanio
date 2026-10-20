'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOOKING_STATUS_LABEL, CATEGORIES, formatINR, type BookingDto, type CheckoutResponse, type TopUpRequestDto, type TopUpStartDto } from '@companio/types';
import { Avatar, Button, Callout, Card, Modal, Toggle } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader } from '@/components/misc';
import { useToast } from '@/components/toast';
import { errMsg, fmtDateTime } from '@/lib/format';
import { track } from '@/lib/analytics';
import { loadRazorpay } from '@/lib/razorpay';
import { payWithCashfree } from '@/lib/cashfree';
import { PayByUpi } from '@/components/add-coins';


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
  // while online payment is off, members pay from their wallet and top it up by UPI QR
  const [manual, setManual] = useState(false);
  const [topup, setTopup] = useState<TopUpRequestDto | null>(null);
  const [qr, setQr] = useState<TopUpStartDto | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.bookings.get(bookingId), api.wallet.get(), api.topups.mode().catch(() => null), api.topups.mine().catch(() => [] as TopUpRequestDto[])])
      .then(([bk, w, mode, mine]) => {
        if (bk.status !== 'PENDING_PAYMENT') router.replace(`/bookings/${bk.id}`);
        setB(bk);
        setBalance(w.balance);
        setManual(!!mode?.manual);
        setTopup(mine.find((t) => t.bookingId === bk.id && (t.status === 'STARTED' || t.status === 'PENDING')) ?? null);
      })
      .catch((e) => toast(errMsg(e), 'error'));
  }, [user, api, bookingId, router, toast]);

  if (!user || !b) return <FullLoader />;
  const walletUse = manual ? Math.min(balance, b.total) : useWallet ? Math.min(balance, b.total) : 0;
  const shortfall = Math.max(0, b.total - balance);
  const topupAmount = Math.max(50, shortfall);

  const startTopup = async () => {
    setBusy(true);
    try {
      setQr(await api.topups.start(topupAmount, b.id));
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const refreshTopup = () =>
    api.topups
      .mine()
      .then((mine) => setTopup(mine.find((t) => t.bookingId === b.id && (t.status === 'STARTED' || t.status === 'PENDING')) ?? null))
      .catch(() => {});
  const cat = CATEGORIES.find((c) => c.slug === b.category);

  const done = () => {
    track({ name: 'purchase', value: b.total, bookingId: b.id, category: b.category });
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
      if (r.provider === 'cashfree') {
        const finished = await payWithCashfree(r.paymentSessionId, r.mode);
        if (!finished) return setBusy(false);
        await api.payments.verify({ orderId: r.orderId, paymentId: '', signature: '' });
        return done();
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
      <p className="mt-1 text-ink-soft">
        {BOOKING_STATUS_LABEL[b.status]} · {manual ? 'pay from your wallet to send the request.' : 'complete within 30 minutes to hold the slot.'}
      </p>
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
        {manual ? (
          <div className="space-y-4">
            <Card tone="lime" className="p-4">
              <p className="text-sm font-bold">Your wallet</p>
              <p className="font-display text-2xl font-extrabold tabular-nums">{formatINR(balance)}</p>
              {shortfall > 0 && <p className="text-xs">{formatINR(shortfall)} more needed for this meetup</p>}
            </Card>
            {shortfall === 0 ? (
              <Button size="lg" className="w-full" loading={busy} onClick={pay}>
                Pay {formatINR(b.total)} from wallet
              </Button>
            ) : topup ? (
              <Card tone="sunny" className="space-y-2 p-4 text-sm">
                <p className="font-bold">{topup.status === 'PENDING' ? '⏳ Checking your UPI payment' : 'Waiting for your UPI payment'}</p>
                <p>
                  {formatINR(topup.amount)} · note <b className="font-mono">{topup.note}</b>
                </p>
                <p className="text-ink-soft">
                  {topup.status === 'PENDING'
                    ? `Once it’s confirmed, this meetup is paid from your wallet and the request goes to ${b.companion.name?.split(' ')[0]} automatically — we’ll notify you. We hold it for up to 24 hours.`
                    : 'Finish paying with the QR, then tap “I’ve paid” in your Wallet.'}
                </p>
                <Button size="sm" variant="white" onClick={refreshTopup}>
                  Check status
                </Button>
              </Card>
            ) : (
              <>
                <Button size="lg" className="w-full" loading={busy} onClick={startTopup}>
                  Add {formatINR(topupAmount)} by UPI & pay
                </Button>
                <p className="text-center text-xs text-ink-mute">
                  Pay by UPI QR, then we confirm it and send your request to {b.companion.name?.split(' ')[0]} automatically. Online card payments are coming soon.
                </p>
              </>
            )}
          </div>
        ) : (
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
        )}
      </div>

      {qr && (
        <PayByUpi
          request={qr}
          onClose={() => {
            setQr(null);
            void refreshTopup();
          }}
        />
      )}

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
