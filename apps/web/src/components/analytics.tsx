'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@companio/ui';
import { CONSENT_CHANGED, TRACKING_ENABLED, getConsent, loadTrackers, setConsent, trackPageView, type Consent } from '@/lib/analytics';
import { captureRef } from '@/lib/referral';

/** Mounted once in the root layout: remembers invite codes, loads trackers after consent, sends page views. */
export function Analytics() {
  const pathname = usePathname();
  const [consent, setConsentState] = useState<Consent | 'unknown'>('unknown');

  useEffect(() => {
    const sync = () => {
      const c = getConsent();
      setConsentState(c);
      if (c === 'granted') loadTrackers();
    };
    sync();
    window.addEventListener(CONSENT_CHANGED, sync);
    return () => window.removeEventListener(CONSENT_CHANGED, sync);
  }, []);

  useEffect(() => {
    // read the query string directly: useSearchParams here would opt every page out of static rendering
    captureRef(window.location.search);
    if (consent === 'granted') trackPageView(pathname);
  }, [pathname, consent]);

  if (!TRACKING_ENABLED || consent !== null) return null;
  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-blob border-3 border-ink bg-white p-4 shadow-brutal sm:inset-x-6 sm:bottom-6 sm:p-5">
      <p className="font-display font-extrabold">🍪 Cookies for a better Companio</p>
      <p className="mt-1 text-sm text-ink-soft">
        We use analytics and ad cookies (Google, Meta) to see which ads bring people here. No tracking unless you allow it.{' '}
        <Link href="/privacy" className="font-semibold underline">
          Privacy policy
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => setConsent('granted')}>
          Accept
        </Button>
        <Button size="sm" variant="white" onClick={() => setConsent('denied')}>
          Decline
        </Button>
      </div>
    </div>
  );
}

/** Footer link that re-opens the banner so visitors can change their choice. */
export function CookieSettingsLink({ className }: { className?: string }) {
  if (!TRACKING_ENABLED) return null;
  return (
    <button type="button" onClick={() => setConsent(null)} className={className}>
      Cookie settings
    </button>
  );
}
