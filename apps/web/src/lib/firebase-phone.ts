'use client';

import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

/**
 * Phone sign-in through Firebase: Firebase sends the SMS (no DLT registration needed) and checks the code;
 * we then hand Firebase's ID token to our API, which issues our own session. Firebase is only used for this step.
 * Enabled when the NEXT_PUBLIC_FIREBASE_* variables are set; otherwise the login page uses the API's own codes (dev).
 */
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : '');
export const FIREBASE_ENABLED = Boolean(apiKey && projectId);

let pending: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

// loaded on demand so the Firebase SDK only downloads on the login page, when a code is requested
async function load() {
  const [{ getApps, initializeApp }, fa] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps()[0] ?? initializeApp({ apiKey, authDomain, projectId });
  const auth = fa.getAuth(app);
  auth.languageCode = 'en';
  return { fa, auth };
}

/** Sends the SMS. `container` hosts Firebase's invisible reCAPTCHA (its abuse check). */
export async function sendFirebaseCode(phone10: string, container: HTMLElement) {
  const { fa, auth } = await load();
  // a fresh element each time: reCAPTCHA can't render twice into the same one (e.g. on "Resend code")
  verifier?.clear();
  container.replaceChildren();
  const el = document.createElement('div');
  container.appendChild(el);
  verifier = new fa.RecaptchaVerifier(auth, el, { size: 'invisible' });
  try {
    pending = await fa.signInWithPhoneNumber(auth, `+91${phone10}`, verifier);
  } catch (e) {
    verifier.clear();
    verifier = null;
    throw e;
  }
}

/** Checks the code with Firebase and returns the ID token to exchange with our API. */
export async function confirmFirebaseCode(code: string): Promise<string> {
  if (!pending) throw Object.assign(new Error('missing confirmation'), { code: 'auth/code-expired' });
  const cred = await pending.confirm(code);
  const idToken = await cred.user.getIdToken();
  pending = null;
  const { fa, auth } = await load();
  await fa.signOut(auth).catch(() => {}); // our API session takes over from here
  return idToken;
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'That doesn’t look like a valid mobile number.',
  'auth/missing-phone-number': 'Enter your mobile number.',
  'auth/too-many-requests': 'Too many attempts from this device. Please wait a while and try again.',
  'auth/quota-exceeded': 'We’ve hit today’s SMS limit. Please try again later.',
  'auth/invalid-verification-code': 'Incorrect code. Check the SMS and try again.',
  'auth/code-expired': 'This code has expired. Request a new one.',
  'auth/captcha-check-failed': 'The security check failed. Please reload the page and try again.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/unauthorized-domain': 'Sign-in isn’t enabled for this website address yet.',
  'auth/operation-not-allowed': 'Phone sign-in isn’t enabled yet.',
  'auth/billing-not-enabled': 'Phone sign-in isn’t fully set up yet.',
};

/** Friendly text for Firebase errors; `null` if it isn't one (so the caller can use its usual message). */
export function firebaseErrorMessage(e: unknown): string | null {
  const code = (e as { code?: unknown })?.code;
  if (typeof code !== 'string' || !code.startsWith('auth/')) return null;
  return MESSAGES[code] ?? 'Couldn’t complete sign-in. Please try again.';
}
