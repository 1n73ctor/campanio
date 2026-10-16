'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Callout } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';

/** Opened from the "Confirm your email" link. Works signed in or not — the token in the link is the proof. */
export function VerifyEmailView() {
  const token = useSearchParams().get('token') ?? '';
  const { api, token: session, refresh } = useAuth();
  const [state, setState] = useState<{ ok: true; email: string } | { ok: false; error: string } | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (!token) return setState({ ok: false, error: 'This link is incomplete — open the latest email from us, or resend it from your profile.' });
    api.me
      .verifyEmail(token)
      .then((r) => {
        setState({ ok: true, email: r.email });
        if (session) void refresh();
      })
      .catch((e) => setState({ ok: false, error: errMsg(e) }));
  }, [api, token, session, refresh]);

  if (!state) return <div className="container-x py-16 text-center text-ink-soft">Confirming your email…</div>;
  return (
    <div className="container-x max-w-xl py-16">
      {state.ok ? (
        <Callout tone="lime" title="Email confirmed ✅">
          Thanks! We’ll send meetup confirmations, reminders and receipts to <b>{state.email}</b>.
        </Callout>
      ) : (
        <Callout tone="white" title="We couldn’t confirm your email">
          {state.error}
        </Callout>
      )}
      <div className="mt-6 flex gap-3">
        <Link href={state.ok ? '/explore' : '/account'}>
          <Button>{state.ok ? 'Find your buddy' : 'Open my profile'}</Button>
        </Link>
      </div>
    </div>
  );
}
