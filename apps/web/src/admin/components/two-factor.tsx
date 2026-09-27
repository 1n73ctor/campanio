'use client';

import { useEffect, useState } from 'react';
import { Button, Callout, Card, Field, Input } from '@companio/ui';
import { errMsg, useAdmin } from '@/admin/lib/api';
import { useToast } from '@/admin/components/toast';

/** The signed-in admin's two-factor sign-in (authenticator app): set up, confirm, or turn off. */
export function TwoFactorCard() {
  const { api } = useAdmin();
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.admin.twoFactor().then((r) => setEnabled(r.enabled)).catch(() => setEnabled(null));
  }, [api]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      setCode('');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const codeInput = (
    <Input
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="123456"
      className="max-w-[10rem] text-center font-display tracking-[0.3em]"
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
    />
  );

  if (enabled === null) return null;
  return (
    <Card className="mb-6 p-6">
      <h2 className="font-display text-lg font-extrabold">🔐 Two-factor sign-in {enabled ? '— on ✅' : '— off'}</h2>
      {enabled ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">Signing in to the admin needs your password and a code from your authenticator app.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Code to turn it off">{codeInput}</Field>
            <Button variant="white" loading={busy} disabled={code.length !== 6} onClick={() => run(() => api.admin.twoFactorDisable(code).then(() => setEnabled(false)), 'Two-factor sign-in turned off')}>
              Turn off
            </Button>
          </div>
        </>
      ) : !setup ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Protects the admin panel even if your password leaks: signing in also needs a 6-digit code from an app like Google Authenticator or Authy.
            Strongly recommended — this panel can see ID documents and move money.
          </p>
          <Button className="mt-3" loading={busy} onClick={() => run(() => api.admin.twoFactorSetup().then((s) => setSetup(s)), 'Scan the QR code with your authenticator app')}>
            Set up two-factor sign-in
          </Button>
        </>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-[180px_1fr]">
          {/* rendered as an image so the SVG can never run as code */}
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`} alt="QR code for your authenticator app" className="w-44 rounded-chunky border-3 border-ink bg-white p-2" />
          <div className="space-y-2 text-sm">
            <p>1. In your authenticator app, add an account and scan this QR code.</p>
            <p>
              Can’t scan? Enter this key: <code className="break-all rounded bg-paper-deep px-1.5 py-0.5 font-mono">{setup.secret}</code>
            </p>
            <p>2. Enter the 6-digit code it shows to finish.</p>
            <div className="flex flex-wrap items-end gap-2">
              {codeInput}
              <Button loading={busy} disabled={code.length !== 6} onClick={() => run(() => api.admin.twoFactorEnable(code).then(() => { setEnabled(true); setSetup(null); }), 'Two-factor sign-in is on')}>
                Turn on
              </Button>
            </div>
            <Callout tone="sunny">Lost your phone later? On the server, run <code>npm run db:create-admin -w @companio/api</code> to reset your password and 2FA.</Callout>
          </div>
        </div>
      )}
    </Card>
  );
}
