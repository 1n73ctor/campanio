import { InternalServerErrorException } from '@nestjs/common';
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
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify({ amount: amount * 100, currency: 'INR', receipt: receipt.slice(0, 40), payment_capture: 1 }),
    });
    if (!res.ok) throw new InternalServerErrorException(`Razorpay order failed: ${await res.text()}`);
    const body = (await res.json()) as { id: string };
    return { orderId: body.id };
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
