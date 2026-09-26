export interface PaymentProvider {
  readonly name: 'mock' | 'razorpay';
  /** amount in rupees */
  createOrder(amount: number, receipt: string): Promise<{ orderId: string }>;
  verifySignature(orderId: string, paymentId: string, signature: string): boolean;
}
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
