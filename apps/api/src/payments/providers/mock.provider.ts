import { createHmac, randomBytes } from 'crypto';
import type { PaymentProvider } from './provider';

const MOCK_SECRET = 'companio-mock-gateway';

/** Local-dev gateway. The web checkout shows a fake UPI/card sheet and calls /payments/mock/:orderId/pay. */
export class MockProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  async createOrder() {
    return { orderId: `mock_order_${randomBytes(8).toString('hex')}` };
  }
  sign(orderId: string, paymentId: string) {
    return createHmac('sha256', MOCK_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  }
  verifySignature(orderId: string, paymentId: string, signature: string) {
    return this.sign(orderId, paymentId) === signature;
  }
}
