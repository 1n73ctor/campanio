'use client';

import { useEffect, useState } from 'react';
import { useAuth, MAINTENANCE_EVENT } from '@/lib/auth';

/**
 * While the site is under maintenance it stays browsable, but sign-in, bookings, payments and chats are paused.
 * Checked on load and every 30s, and shown at once if an action is refused for maintenance.
 */
export function MaintenanceBanner() {
  const { api } = useAuth();
  const [on, setOn] = useState(false);

  useEffect(() => {
    const check = () => api.meta.status().then((s) => setOn(s.maintenance)).catch(() => {});
    check();
    const t = setInterval(check, 30_000);
    const now = () => setOn(true);
    window.addEventListener(MAINTENANCE_EVENT, now);
    return () => {
      clearInterval(t);
      window.removeEventListener(MAINTENANCE_EVENT, now);
    };
  }, [api]);

  if (!on) return null;
  return (
    <div role="status" className="border-b-3 border-ink bg-sunny">
      <p className="container-x py-2.5 text-center text-sm">
        🛠️ <b>Maintenance in progress</b> — you can keep browsing, but sign-in, bookings, payments and chats are paused for a few minutes.
      </p>
    </div>
  );
}
