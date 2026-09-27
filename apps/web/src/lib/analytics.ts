'use client';

/**
 * Ad & analytics tracking (GA4 + Meta Pixel). Nothing loads unless an ID is configured AND the visitor accepted
 * the consent banner — India's DPDP Act expects consent before tracking. Unconfigured (e.g. local dev) = no-op.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
export const TRACKING_ENABLED = Boolean(GA_ID || META_PIXEL_ID);

const CONSENT_KEY = 'companio.consent';
export const CONSENT_CHANGED = 'companio:consent-changed';
export type Consent = 'granted' | 'denied' | null;

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; push: unknown; loaded: boolean; version: string };
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: Consent) {
  try {
    if (v) localStorage.setItem(CONSENT_KEY, v);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {}
  window.dispatchEvent(new Event(CONSENT_CHANGED));
}

let loaded = false;
/** Injects the vendor scripts once. Their stubs queue calls, so events fired before the scripts finish still arrive. */
export function loadTrackers() {
  if (loaded || !TRACKING_ENABLED || getConsent() !== 'granted') return;
  loaded = true;
  if (GA_ID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // GA4 requires the real `arguments` object, not an array
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { send_page_view: false }); // page views are sent on every route change instead
    addScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
  }
  if (META_PIXEL_ID) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = window._fbq = fbq;
    addScript('https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
  }
}

function addScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

export function trackPageView(path: string) {
  if (!loaded) return;
  window.gtag?.('event', 'page_view', { page_path: path, page_location: window.location.href, page_title: document.title });
  window.fbq?.('track', 'PageView');
}

/**
 * Funnel events, mapped to each platform's standard names so they can be used as ad conversions:
 *   sign_up          → GA4 sign_up          / Meta CompleteRegistration
 *   begin_checkout   → GA4 begin_checkout   / Meta InitiateCheckout   (booking created)
 *   purchase         → GA4 purchase         / Meta Purchase           (booking paid)
 *   companion_apply  → GA4 generate_lead    / Meta Lead               (supply-side sign-up)
 */
type Event =
  | { name: 'sign_up' }
  | { name: 'begin_checkout'; value: number; bookingId: string; category: string }
  | { name: 'purchase'; value: number; bookingId: string; category: string }
  | { name: 'companion_apply' };

export function track(e: Event) {
  if (!loaded) return;
  const money = 'value' in e ? { currency: 'INR', value: e.value } : {};
  switch (e.name) {
    case 'sign_up':
      window.gtag?.('event', 'sign_up', { method: 'phone' });
      window.fbq?.('track', 'CompleteRegistration');
      break;
    case 'begin_checkout':
      window.gtag?.('event', 'begin_checkout', { ...money, items: [{ item_id: e.category, item_name: e.category }] });
      window.fbq?.('track', 'InitiateCheckout', { ...money, content_category: e.category });
      break;
    case 'purchase':
      window.gtag?.('event', 'purchase', { ...money, transaction_id: e.bookingId, items: [{ item_id: e.category, item_name: e.category }] });
      window.fbq?.('track', 'Purchase', { ...money, content_category: e.category }, { eventID: e.bookingId });
      break;
    case 'companion_apply':
      window.gtag?.('event', 'generate_lead');
      window.fbq?.('track', 'Lead');
      break;
  }
}
