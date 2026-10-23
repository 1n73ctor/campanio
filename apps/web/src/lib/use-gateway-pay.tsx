'use client';

import { useRef, useState } from 'react';
import { formatINR, type FeeCheckoutResponse } from '@companio/types';
import { Button, Callout, Modal } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { loadRazorpay } from '@/lib/razorpay';
import { payWithCashfree } from '@/lib/cashfree';
import { useToast } from '@/components/toast';

/**
 * Finishes a gateway payment the API started (mock, Cashfree or Razorpay). `pay()` resolves true once the server has
 * confirmed it, false if the person closed the window. Render `modal` (used by the local mock gateway).
 */
export function useGatewayPay(description: string) {
  const { api, user } = useAuth();
  const toast = useToast();
  const [mock, setMock] = useState<{ orderId: string; amount: number } | null>(null);
  const [mockBusy, setMockBusy] = useState(false);
  const settle = useRef<((paid: boolean) => void) | null>(null);
  const finish = (paid: boolean) => {
    settle.current?.(paid);
    settle.current = null;
  };

  const pay = async (r: FeeCheckoutResponse): Promise<boolean> => {
    if (r.status === 'PAID') return true;
    const done = new Promise<boolean>((resolve) => (settle.current = resolve));
    if (r.provider === 'mock') {
      setMock({ orderId: r.orderId, amount: r.amount });
      return done;
    }
    if (r.provider === 'cashfree') {
      try {
        if (await payWithCashfree(r.paymentSessionId, r.mode)) {
          await api.payments.verify({ orderId: r.orderId, paymentId: '', signature: '' });
          finish(true);
        } else finish(false);
      } catch (e) {
        toast(errMsg(e), 'error');
        finish(false);
      }
      return done;
    }
    await loadRazorpay();
    new window.Razorpay!({
      key: r.keyId,
      order_id: r.orderId,
      amount: r.amount * 100,
      currency: 'INR',
      name: 'Companio',
      description,
      prefill: { contact: user?.phone ?? undefined, name: user?.name ?? undefined, email: user?.email ?? undefined },
      theme: { color: '#FF7AC6' },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await api.payments.verify({ orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature });
          finish(true);
        } catch (e) {
          toast(errMsg(e), 'error');
          finish(false);
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
        className="mt-3 w-full"
        loading={mockBusy}
        onClick={async () => {
          if (!mock) return;
          setMockBusy(true);
          try {
            await api.payments.verify(await api.payments.mockPay(mock.orderId));
            setMock(null);
            finish(true);
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

  return { pay, modal };
}
