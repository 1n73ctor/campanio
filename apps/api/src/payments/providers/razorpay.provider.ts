import { InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { PaymentProvider } from './provider';

/**
 * Razorpay Orders API. Booking payments are for a real-world service (a companion's time),
 * so they go through our own gateway rather than App Store / Play in-app purchase.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;
  constructor(
    readonly keyId: string,
    private keySecret: string,
    private webhookSecret: string,
  ) {}

  async createOrder(amount: number, receipt: string) {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.auth,
      },
      body: JSON.stringify({ amount: amount * 100, currency: 'INR', receipt: receipt.slice(0, 40), payment_capture: 1 }),
    });
    if (!res.ok) throw new InternalServerErrorException(`Razorpay order failed: ${await res.text()}`);
    const body = (await res.json()) as { id: string };
    return { orderId: body.id };
  }

  private get auth() {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  /**
   * Asks Razorpay itself about a payment, so nothing the browser sends decides what was paid: it must belong to this
   * order, be in INR, for exactly `amount` rupees, and be captured (an authorised-only payment is captured here).
   * Returns false when it doesn't match; throws if Razorpay can't be reached (the caller retries later).
   */
  async confirm(paymentId: string, orderId: string, amount: number): Promise<boolean> {
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) return false;
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, { headers: { Authorization: this.auth }, signal: AbortSignal.timeout(15_000) });
    if (res.status === 400 || res.status === 404) return false;
    if (!res.ok) throw new ServiceUnavailableException('Couldn’t confirm the payment with Razorpay right now — it’ll be confirmed automatically in a few minutes.');
    const p = (await res.json()) as { order_id?: string; amount?: number; currency?: string; status?: string };
    if (p.order_id !== orderId || p.amount !== amount * 100 || p.currency !== 'INR') return false;
    if (p.status === 'captured') return true;
    if (p.status !== 'authorized') return false;
    const cap = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
      method: 'POST',
      headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount * 100, currency: 'INR' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (cap.ok) return ((await cap.json()) as { status?: string }).status === 'captured';
    throw new ServiceUnavailableException('Couldn’t confirm the payment with Razorpay right now — it’ll be confirmed automatically in a few minutes.');
  }

  verifySignature(orderId: string, paymentId: string, signature: string) {
    return safeEq(createHmac('sha256', this.keySecret).update(`${orderId}|${paymentId}`).digest('hex'), signature);
  }

  verifyWebhook(rawBody: Buffer, signature: string) {
    if (!this.webhookSecret) return false;
    return safeEq(createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex'), signature);
  }
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b ?? '');
  return x.length === y.length && timingSafeEqual(x, y);
}
