import { BadGatewayException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Customer, PaymentProvider } from './provider';

const API_VERSION = '2023-08-01';

/**
 * Cashfree Payment Gateway (Orders API + Cashfree Checkout JS). A payment only counts once *our server* has asked
 * Cashfree and Cashfree says the order is PAID for the right amount — nothing the browser sends is trusted.
 */
export class CashfreeProvider implements PaymentProvider {
  readonly name = 'cashfree' as const;
  private base: string;
  constructor(
    private appId: string,
    private secret: string,
    readonly mode: 'sandbox' | 'production',
    private notifyUrl: string,
  ) {
    this.base = mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  }

  private headers() {
    return { 'x-client-id': this.appId, 'x-client-secret': this.secret, 'x-api-version': API_VERSION, 'Content-Type': 'application/json' };
  }

  async createOrder(amount: number, receipt: string, customer?: Customer) {
    // Cashfree order ids: letters, numbers, - and _ only, max 50
    const orderId = `cf_${receipt.replace(/[^\w-]/g, '').slice(0, 30)}_${randomBytes(5).toString('hex')}`;
    const phone = (customer?.phone ?? '').replace(/\D/g, '').slice(-10);
    const res = await fetch(`${this.base}/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: (customer?.id ?? 'guest').replace(/[^\w-]/g, '').slice(0, 50),
          customer_phone: phone.length === 10 ? phone : '9999999999',
          ...(customer?.name ? { customer_name: customer.name.slice(0, 100) } : {}),
          ...(customer?.email ? { customer_email: customer.email } : {}),
        },
        order_meta: { notify_url: this.notifyUrl },
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { payment_session_id?: string; message?: string } | null;
    if (!res?.ok || !body?.payment_session_id) throw new BadGatewayException(`Couldn’t start the payment (${body?.message ?? 'Cashfree unreachable'}) — please try again`);
    return { orderId, sessionId: body.payment_session_id };
  }

  /** Asks Cashfree directly whether the order is paid, and for exactly the amount we created it for. */
  async confirm(orderId: string, expectedAmount: number): Promise<{ paid: boolean; paymentId: string }> {
    const res = await fetch(`${this.base}/orders/${encodeURIComponent(orderId)}`, { headers: this.headers(), signal: AbortSignal.timeout(20_000) }).catch(() => null);
    const o = (await res?.json().catch(() => null)) as { order_status?: string; order_amount?: number; cf_order_id?: string | number } | null;
    if (!res?.ok || !o) throw new BadGatewayException('Couldn’t confirm the payment with Cashfree — please try again in a moment');
    return { paid: o.order_status === 'PAID' && Math.round(Number(o.order_amount) * 100) === Math.round(expectedAmount * 100), paymentId: String(o.cf_order_id ?? orderId) };
  }

  /** Webhook signature: base64(HMAC-SHA256(timestamp + raw body, secret key)). */
  verifyWebhook(rawBody: Buffer, signature: string, timestamp: string) {
    if (!signature || !timestamp) return false;
    const expected = createHmac('sha256', this.secret).update(timestamp + rawBody.toString('utf8')).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // the browser never proves a Cashfree payment; confirm() does
  verifySignature() {
    return false;
  }
}
