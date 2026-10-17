'use client';

import { useEffect, useState } from 'react';
import { endViewAs, useAuth } from '@/lib/auth';

/** At the top of every page while an admin views the site as someone: who, read-only, when it ends, and a way out. */
export function ViewAsBanner() {
  const { viewAs, user } = useAuth();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!viewAs) return;
    const t = setInterval(() => {
      if (new Date(viewAs.expiresAt).getTime() <= Date.now()) exit();
      tick((n) => n + 1);
    }, 30_000);
    return () => clearInterval(t);
  }, [viewAs]);
  if (!viewAs) return null;

  function exit() {
    endViewAs();
    window.location.replace(viewAs?.back ?? '/admin/users');
  }
  const ends = new Date(viewAs.expiresAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="border-b-3 border-ink bg-ink text-white">
      <div className="container-x flex flex-wrap items-center gap-x-4 gap-y-2 py-2 text-sm">
        <p className="min-w-0 flex-1">
          <b>👁 Admin view</b> — you’re seeing Companio as <b>{user?.name ?? 'this user'}</b>. Read-only: nothing you do here is saved. Ends at {ends} IST.
        </p>
        <button type="button" onClick={exit} className="rounded-full border-2 border-white px-3 py-1 font-bold hover:bg-white hover:text-ink">
          Exit view
        </button>
      </div>
    </div>
  );
}
