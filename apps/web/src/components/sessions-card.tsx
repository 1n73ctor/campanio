'use client';

import { useState } from 'react';
import { Button, Card } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { useToast } from './toast';

/** Signs out every other phone/browser (e.g. a lost phone or a shared computer); this one stays signed in. */
export function SessionsCard() {
  const { api, user, signIn } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mt-6 p-6">
      <h2 className="font-display text-lg font-extrabold">Signed-in devices</h2>
      <p className="mt-1 text-sm text-ink-soft">Lost a phone or used a shared computer? Sign out everywhere except this device.</p>
      <Button
        variant="white"
        className="mt-4"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { token } = await api.me.logoutOthers();
            if (user) signIn(token, user);
            toast('Signed out of all other devices');
          } catch (e) {
            toast(errMsg(e), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        Log out of all other devices
      </Button>
    </Card>
  );
}
