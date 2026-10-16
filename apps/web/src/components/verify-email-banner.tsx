'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { errMsg } from '@/lib/format';

const HIDE_KEY = 'companio.verifyEmailBanner.hidden';

/** Signed-in members whose email isn't verified yet: one tap emails them the verification link. */
export function VerifyEmailBanner() {
  const { api, user, setUser } = useAuth();
  const path = usePathname();
  const toast = useToast();
  const [hidden, setHidden] = useState(true);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(HIDE_KEY) === '1');
    } catch {
      setHidden(false);
    }
  }, []);

  // the account page has its own verify box; the verify page is where the link lands
  if (hidden || !user?.onboarded || !user.email || user.emailVerified || user.role === 'ADMIN' || path === '/account' || path === '/verify-email') return null;

  const send = async () => {
    setBusy(true);
    try {
      const r = await api.me.resendEmailVerification();
      if (r.verified) setUser(await api.me.get());
      else setSent(true);
      toast(r.verified ? 'Your email is already verified' : `Verification link sent to ${user.email}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const hide = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(HIDE_KEY, '1');
    } catch {}
  };

  return (
    <div className="border-b-3 border-ink bg-sunny">
      <div className="container-x flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 text-sm">
        <p className="min-w-0 flex-1">
          <b>Verify your email</b>{' '}
          <span className="text-ink-soft">
            {sent ? `— we sent a link to ${user.email}. Check your inbox and spam folder.` : `so we can send meetup confirmations, reminders and receipts to ${user.email}.`}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" loading={busy} onClick={send}>
            {sent ? 'Send again' : 'Verify email'}
          </Button>
          <button type="button" onClick={hide} aria-label="Hide for now" className="px-2 text-lg font-bold leading-none">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
