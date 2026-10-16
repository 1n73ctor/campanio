'use client';

type CashfreeResult = { error?: { message?: string }; paymentDetails?: { paymentMessage?: string }; redirect?: boolean };
declare global {
  interface Window {
    Cashfree?: (opts: { mode: 'sandbox' | 'production' }) => { checkout: (o: { paymentSessionId: string; redirectTarget: '_modal' }) => Promise<CashfreeResult> };
  }
}

/** Loads Cashfree Checkout once (booking checkout and the host registration fee). */
const load = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window — check your connection and try again'));
    document.body.appendChild(s);
  });

/**
 * Opens Cashfree's payment window. Resolves true when the person finished paying (the server still confirms it with
 * Cashfree before anything is marked paid), false if they closed the window.
 */
export async function payWithCashfree(sessionId: string, mode: 'sandbox' | 'production'): Promise<boolean> {
  await load();
  const r = await window.Cashfree!({ mode }).checkout({ paymentSessionId: sessionId, redirectTarget: '_modal' });
  return !r.error && !!r.paymentDetails;
}
