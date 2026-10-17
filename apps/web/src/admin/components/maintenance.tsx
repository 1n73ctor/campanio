'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Modal } from '@companio/ui';
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

/** Dashboard card: one button to put the whole site under maintenance (with a confirmation), or bring it back. */
export function MaintenanceCard() {
  const on = useMaintenance();
  const { set, busy } = useSwitch();
  const [confirm, setConfirm] = useState(false);
  if (on === null) return null;
  return (
    <>
      <Card tone={on ? 'pink' : 'white'} className="mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-display text-lg font-extrabold">{on ? '🛠️ The site is under maintenance' : '🟢 The site is online'}</p>
          <p className="text-sm text-ink-soft">
            {on
              ? 'People can still browse, but sign-in, bookings, payments, chats and withdrawals are paused. The admin panel works as normal.'
              : 'Need to fix something? Pause all changes on the site with one click — people can keep browsing.'}
          </p>
        </div>
        {on ? (
          <Button variant="lime" loading={busy} onClick={() => set(false)}>
            Bring the site back online
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Put site under maintenance
          </Button>
        )}
      </Card>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Put the site under maintenance?"
        footer={
          <Button variant="danger" loading={busy} onClick={async () => (await set(true)) && setConfirm(false)}>
            Yes, start maintenance
          </Button>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>The website and app stay open for browsing, with a “maintenance in progress” banner.</li>
          <li>Nobody can sign in, book, pay, chat, withdraw or edit their profile until you turn it off. Payments already under way still complete.</li>
          <li>Timers keep running: unanswered requests still expire and are refunded as usual.</li>
          <li>The admin panel keeps working. Turn it off here when you’re done.</li>
        </ul>
      </Modal>
    </>
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
