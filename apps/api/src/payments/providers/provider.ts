export interface Customer {
  id: string;
  phone?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface PaymentProvider {
  readonly name: 'mock' | 'razorpay' | 'cashfree';
  /** amount in rupees; sessionId is what the browser opens checkout with (Cashfree) */
  createOrder(amount: number, receipt: string, customer?: Customer): Promise<{ orderId: string; sessionId?: string }>;
  verifySignature(orderId: string, paymentId: string, signature: string): boolean;
}
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
