'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Toggle } from '@companio/ui';
import { errMsg, useAdmin } from '@/admin/lib/api';
import { useToast } from '@/admin/components/toast';

const CHANGED = 'companio:maintenance-changed';

/** Whether the site is under maintenance, kept fresh (every 20s, and straight after a switch). */
function useMaintenance() {
  const { api } = useAdmin();
  const [on, setOn] = useState<boolean | null>(null);
  const load = useCallback(() => api.meta.status().then((s) => setOn(s.maintenance)).catch(() => {}), [api]);
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    window.addEventListener(CHANGED, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(CHANGED, load);
    };
  }, [load]);
  return on;
}

function useSwitch() {
  const { api } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const set = async (on: boolean) => {
    setBusy(true);
    try {
      await api.admin.setMaintenance(on);
      window.dispatchEvent(new Event(CHANGED));
      toast(on ? 'Maintenance on — the site is browsable, changes are paused' : 'Maintenance off — everything works again');
      return true;
    } catch (e) {
      toast(errMsg(e), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { set, busy };
}

/** Dashboard card: one switch puts the site under maintenance (browsing stays open, changes pause) or back. */
export function MaintenanceCard() {
  const on = useMaintenance();
  const { set, busy } = useSwitch();
  if (on === null) return null;
  return (
    <Card tone={on ? 'pink' : 'white'} className="mb-6 flex items-center justify-between gap-4 p-5">
      <div>
        <p className="font-display text-lg font-extrabold">🛠️ Maintenance mode</p>
        <p className="text-sm text-ink-soft">
          {on ? 'On — people can browse, but sign-in, bookings, payments and chats are paused.' : 'Off — everything works normally.'}
        </p>
      </div>
      <Toggle checked={on} disabled={busy} onChange={(v) => void set(v)} label="Maintenance mode" />
    </Card>
  );
}

/** A red bar across every admin page while the site is under maintenance, so it's never left on by mistake. */
export function MaintenanceBanner() {
  const on = useMaintenance();
  const { set, busy } = useSwitch();
  if (!on) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b-3 border-ink bg-danger px-4 py-2 text-center text-sm font-extrabold text-white">
      🛠️ Maintenance is on — people can browse, but sign-in, bookings, payments and chats are paused.
      <button type="button" disabled={busy} onClick={() => set(false)} className="rounded-full border-2 border-white px-3 py-0.5 hover:bg-white hover:text-danger">
        {busy ? 'Turning off…' : 'Bring it back online'}
      </button>
    </div>
  );
}
