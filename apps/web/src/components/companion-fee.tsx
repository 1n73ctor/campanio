'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatINR, type CompanionFeeDto } from '@companio/types';
import { Button, Callout, Card, Modal, Toggle } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { loadRazorpay } from '@/lib/razorpay';
import { useToast } from './toast';

/**
 * Companion registration fee (set per gender by admins). `fee.due` false → show nothing and never charge.
 * `pay()` resolves true once the payment is confirmed, false if the person closes the payment window.
 */
export function useCompanionFee() {
  const { api, user } = useAuth();
  const toast = useToast();
  const [fee, setFee] = useState<CompanionFeeDto | null>(null);
  const [balance, setBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(true);
  const [mock, setMock] = useState<{ orderId: string; amount: number } | null>(null);
  const [mockBusy, setMockBusy] = useState(false);
  const settle = useRef<((paid: boolean) => void) | null>(null);

  const reload = useCallback(async () => {
    const [f, w] = await Promise.all([api.companion.fee(), api.wallet.get().catch(() => null)]);
    setFee(f);
    // only withdrawable money pays the fee — welcome credit, cashback and rewards are for bookings
    setBalance(w ? (w.withdrawable ?? w.balance) : 0);
    return f;
  }, [api]);

  useEffect(() => {
    if (user?.onboarded) reload().catch(() => setFee(null)); // if this fails the API still enforces the fee on submit
  }, [user?.onboarded, reload]);

  const finish = async (paid: boolean) => {
    if (paid) await reload();
    settle.current?.(paid);
    settle.current = null;
  };

  const pay = async (): Promise<boolean> => {
    const r = await api.payments.companionFee(useWallet && balance > 0);
    if (r.status === 'PAID') {
      await reload();
      return true;
    }
    const done = new Promise<boolean>((resolve) => (settle.current = resolve));
    if (r.provider === 'mock') {
      setMock({ orderId: r.orderId, amount: r.amount });
      return done;
    }
    await loadRazorpay();
    new window.Razorpay!({
      key: r.keyId,
      order_id: r.orderId,
      amount: r.amount * 100,
      currency: 'INR',
      name: 'Companio',
      description: 'Host registration fee',
      prefill: { contact: user?.phone ?? undefined, name: user?.name ?? undefined },
      theme: { color: '#FF7AC6' },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await api.payments.verify({ orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature });
          await finish(true);
        } catch (e) {
          toast(errMsg(e), 'error');
          await finish(false);
        }
      },
      modal: { ondismiss: () => finish(false) },
    }).open();
    return done;
  };

  const modal = (
    <Modal
      open={!!mock}
      onClose={() => {
        setMock(null);
        finish(false);
      }}
      title="Test payment gateway"
    >
      <Callout tone="lavender">This is the local mock gateway (PAYMENT_PROVIDER=mock). No real money moves.</Callout>
      <Button
        size="lg"
        className="w-full"
        loading={mockBusy}
        onClick={async () => {
          if (!mock) return;
          setMockBusy(true);
          try {
            await api.payments.verify(await api.payments.mockPay(mock.orderId));
            setMock(null);
            await finish(true);
          } catch (e) {
            toast(errMsg(e), 'error');
          } finally {
            setMockBusy(false);
          }
        }}
      >
        Pay {formatINR(mock?.amount ?? 0)}
      </Button>
    </Modal>
  );

  return { fee, balance, useWallet, setUseWallet, pay, reload, modal };
}

/** Price breakdown shown before paying. Renders nothing unless a fee is due. */
export function CompanionFeeSummary({ fee, balance, useWallet, setUseWallet }: Pick<ReturnType<typeof useCompanionFee>, 'fee' | 'balance' | 'useWallet' | 'setUseWallet'>) {
  if (!fee?.due) return null;
  const fromWallet = useWallet ? Math.min(balance, fee.total) : 0;
  return (
    <Card tone="sunny" className="space-y-2 p-5 text-sm">
      <p className="font-display text-lg font-extrabold">One-time registration fee</p>
      <Row l="Registration fee" r={formatINR(fee.amount)} />
      <Row l={`GST (${fee.gstPct}%)`} r={formatINR(fee.gst)} />
      {fromWallet > 0 && <Row l="From your wallet" r={`− ${formatINR(fromWallet)}`} />}
      <div className="flex justify-between border-t-2 border-dashed border-ink/20 pt-2 font-display text-base font-extrabold">
        <span>To pay</span>
        <span className="tabular-nums">{formatINR(fee.total - fromWallet)}</span>
      </div>
      {balance > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span>Use wallet balance ({formatINR(balance)})</span>
          <Toggle checked={useWallet} onChange={setUseWallet} label="Use wallet balance" />
        </div>
      )}
      <p className="text-xs text-ink-soft">
        {fee.refundedAt ? 'Your previous fee was refunded, so re-applying needs a new payment. ' : ''}
        If your verification isn’t approved, our team may refund the fee to your wallet.
      </p>
    </Card>
  );
}

const Row = ({ l, r }: { l: string; r: string }) => (
  <div className="flex justify-between">
    <span>{l}</span>
    <span className="font-semibold tabular-nums">{r}</span>
  </div>
);
