'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/env';

/** Checks every 20s and takes the visitor back as soon as the site is open again. */
export function BackSoon() {
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    try {
      const r = await fetch(`${API_URL}/meta/status`, { cache: 'no-store' });
      if (r.ok && (await r.json()).maintenance === false) window.location.replace(sessionStorage.getItem('companio.backTo') || '/');
    } catch {
      // still down (or restarting) — try again on the next tick
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    try {
      if (window.location.pathname !== '/maintenance') sessionStorage.setItem('companio.backTo', window.location.pathname + window.location.search);
    } catch {}
    const t = setInterval(check, 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button type="button" onClick={check} className="mt-6 rounded-full border-3 border-ink bg-lime px-5 py-2 font-display font-extrabold shadow-brutal-sm">
      {checking ? 'Checking…' : 'Try again'}
    </button>
  );
}
