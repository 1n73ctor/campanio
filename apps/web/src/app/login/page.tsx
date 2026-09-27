'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Callout, Card, Field, Input, Logo } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { track } from '@/lib/analytics';
import { captureRef, clearRef, getRef } from '@/lib/referral';
import { FIREBASE_ENABLED, confirmFirebaseCode, firebaseErrorMessage, sendFirebaseCode } from '@/lib/firebase-phone';
import { REFERRAL_REWARD, formatINR } from '@companio/types';

function LoginInner() {
  const { api, signIn, user, ready } = useAuth();
  const router = useRouter();
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    captureRef(window.location.search); // this page's effect runs before the layout's, so capture here too
    setInvited(!!getRef());
  }, []);
  const next = useSearchParams().get('next') || '/explore';
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready && user) router.replace(user.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`);
  }, [ready, user, router, next]);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      if (FIREBASE_ENABLED) {
        await sendFirebaseCode(phone, recaptchaRef.current!);
      } else {
        const r = await api.auth.requestOtp(phone);
        setDevCode(r.devCode ?? null);
      }
      setStep('code');
      setCooldown(30);
    } catch (e) {
      setError(firebaseErrorMessage(e) ?? errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = FIREBASE_ENABLED
        ? await api.auth.firebase(await confirmFirebaseCode(code), getRef())
        : await api.auth.verifyOtp(phone, code, getRef());
      if (r.isNew) track({ name: 'sign_up' });
      clearRef(); // the code only applies to a brand-new account, so it's spent either way
      signIn(r.token, r.user);
      router.replace(r.user.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`);
    } catch (e) {
      setError(firebaseErrorMessage(e) ?? errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="dots flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-7">
        <Logo className="mb-6" />
        <h1 className="text-3xl font-extrabold">{step === 'phone' ? 'Hey there 👋' : 'Enter your code'}</h1>
        <p className="mt-1 text-ink-soft">{step === 'phone' ? 'Log in or sign up with your mobile number.' : `We sent a 6-digit code to +91 ${phone.slice(-10)}.`}</p>
        {invited && step === 'phone' && (
          <Callout tone="lime" title="🎁 You were invited!" className="mt-5">
            Sign up and you and your friend both get {formatINR(REFERRAL_REWARD)} wallet credit after your first booking.
          </Callout>
        )}
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            step === 'phone' ? send() : verify();
          }}
        >
          {step === 'phone' ? (
            <Field label="Mobile number" error={error}>
              <div className="flex">
                <span className="flex h-11 items-center rounded-l-chunky border-3 border-r-0 border-ink bg-paper-deep px-3 font-bold">+91</span>
                <Input
                  className="rounded-l-none"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  autoFocus
                  required
                />
              </div>
            </Field>
          ) : (
            <Field label="One-time code" error={error}>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                className="text-center font-display text-2xl tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
              />
            </Field>
          )}
          {/* Firebase's invisible reCAPTCHA mounts here */}
          <div ref={recaptchaRef} />
          {devCode && step === 'code' && (
            <Callout tone="lavender" title="Dev mode">
              Your code is <b className="font-mono text-ink">{devCode}</b> (shown because OTP_DEV_ECHO is on).
            </Callout>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={step === 'phone' ? phone.length !== 10 : code.length !== 6}>
            {step === 'phone' ? 'Send code' : 'Verify & continue'}
          </Button>
          {step === 'code' && (
            <div className="flex justify-between text-sm font-semibold">
              <button type="button" className="underline" onClick={() => { setStep('phone'); setCode(''); setError(null); }}>
                Change number
              </button>
              <button type="button" className="underline disabled:no-underline disabled:opacity-50" disabled={cooldown > 0 || busy} onClick={send}>
                {cooldown ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          )}
        </form>
        <p className="mt-6 text-xs text-ink-mute">
          By continuing you confirm you’re 18+ and agree to our <Link href="/terms" className="underline">Terms</Link>, <Link href="/privacy" className="underline">Privacy Policy</Link> and{' '}
          <Link href="/community-guidelines" className="underline">platonic-only guidelines</Link>.
        </p>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
