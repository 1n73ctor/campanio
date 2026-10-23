'use client';

import { useEffect, useState } from 'react';
import { VIEW_AS_KEY, type ViewAs } from '@/lib/auth';

/**
 * Opened by the admin panel's "Log in as user" in a new tab. The session token comes in the URL #fragment — browsers
 * never send that part to any server, log or referrer — and is wiped from the address bar straight away.
 */
export function ViewAsStart() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, '', '/view-as');
    // browsers copy the opener tab's sessionStorage into this one — drop the admin's own sign-in from this tab
    try {
      sessionStorage.removeItem('companio.admin.token');
    } catch {}
    const token = p.get('token') ?? '';
    const expiresAt = p.get('exp') ?? '';
    const back = p.get('back') ?? '';
    if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token) || !(new Date(expiresAt).getTime() > Date.now())) {
      setError('This link has expired or is incomplete. Start again from the admin panel.');
      return;
    }
    const v: ViewAs = { token, expiresAt, back: back.startsWith('/admin/') ? back : '/admin/users', full: p.get('mode') === 'full' };
    try {
      sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(v));
    } catch {
      setError('Your browser blocked session storage, so the view can’t start.');
      return;
    }
    window.location.replace('/'); // full load, so the whole site picks up the session
  }, []);

  return <div className="container-x py-16 text-center text-ink-soft">{error ?? 'Opening the site as this user…'}</div>;
}
