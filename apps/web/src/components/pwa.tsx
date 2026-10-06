'use client';

import { useEffect, useState } from 'react';
import { Button } from '@companio/ui';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registers the service worker and offers an "install app" prompt (PWA = app-lite until the native apps ship). */
export function PwaRegister() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => {});
      // in dev, drop any worker left over from a production run on this origin — it would serve stale code
      else navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    }
    let dismissed = false;
    try {
      dismissed = localStorage.getItem('companio.installDismissed') === '1';
    } catch {}
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      if (!dismissed) setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden || !evt) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-blob border-3 border-ink bg-sunny p-3 shadow-brutal sm:bottom-6">
      <span className="text-2xl">📲</span>
      <p className="flex-1 text-sm font-semibold">Add Companio to your home screen for faster meetups & alerts.</p>
      <Button size="sm" variant="dark" onClick={() => evt.prompt().finally(() => setHidden(true))}>
        Install
      </Button>
      <button
        aria-label="Dismiss"
        className="font-bold"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem('companio.installDismissed', '1');
          } catch {}
        }}
      >
        ×
      </button>
    </div>
  );
}
