'use client';

import { useCallback, useEffect, useState } from 'react';
import { Toggle } from '@companio/ui';
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

/** Dashboard switch (top right): puts the site under maintenance (browsing stays open, changes pause) or back. */
export function MaintenanceSwitch() {
  const on = useMaintenance();
  const { set, busy } = useSwitch();
  if (on === null) return null;
  return (
    <label
      title={on ? 'On — people can browse, but sign-in, bookings, payments and chats are paused' : 'Off — everything works normally'}
      className={`flex cursor-pointer items-center gap-2 rounded-full border-2 border-ink px-3 py-1 text-sm font-bold ${on ? 'bg-pink' : 'bg-white'}`}
    >
      🛠️ Maintenance
      <Toggle checked={on} disabled={busy} onChange={(v) => void set(v)} label="Maintenance mode" />
    </label>
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
