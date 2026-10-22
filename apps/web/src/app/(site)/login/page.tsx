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
import { safeNext } from '@/lib/safe-next';

function LoginInner() {
  const { api, signIn, user, ready } = useAuth();
  const router = useRouter();
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    captureRef(window.location.search); // this page's effect runs before the layout's, so capture here too
    setInvited(!!getRef());
  }, []);
  const next = safeNext(useSearchParams().get('next'));
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // how this code was sent: WhatsApp (our API) first, SMS (Firebase) for numbers without WhatsApp, or the API's dev codes
  const [via, setVia] = useState<'whatsapp' | 'sms' | 'dev'>('whatsapp');
  const [sentAt, setSentAt] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready && user) router.replace(user.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`);
  }, [ready, user, router, next]);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /** SMS through Firebase (or the API's own codes in local dev). */
  const sendSms = async () => {
    if (FIREBASE_ENABLED) {
      await sendFirebaseCode(phone, recaptchaRef.current!);
      setVia('sms');
      setDevCode(null);
    } else {
      const r = await api.auth.requestOtp(phone, 'sms');
      setVia('dev');
      setDevCode(r.devCode ?? null);
    }
  };

  /** WhatsApp first; if our API can't send it (not set up, or Meta refused it) the code goes by SMS instead. */
  const send = async (channel: 'whatsapp' | 'sms' = 'whatsapp') => {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      let r: Awaited<ReturnType<typeof api.auth.requestOtp>> | null = null;
      if (channel === 'whatsapp') {
        try {
          r = await api.auth.requestOtp(phone, 'whatsapp');
        } catch (e) {
          if ((e as { status?: number }).status === 429) throw e; // too many codes: don't try another way
          r = null;
        }
      }
      if (r?.sent && r.channel === 'whatsapp') {
        setVia('whatsapp');
        setDevCode(r.devCode ?? null);
      } else if (r?.sent && !FIREBASE_ENABLED) {
        setVia('dev');
        setDevCode(r.devCode ?? null);
      } else {
        await sendSms();
      }
      setStep('code');
      setSentAt(Date.now());
      setCooldown(30);
    } catch (e) {
      setError(firebaseErrorMessage(e) ?? errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  /** "Send by SMS instead" — or automatically when Meta says the WhatsApp message failed (number not on WhatsApp). */
  const smsInstead = async (auto: boolean) => {
    setError(null);
    setBusy(true);
    try {
      await sendSms();
      setCode('');
      setSentAt(Date.now());
      setCooldown(30);
      setNote(auto ? 'This number doesn’t seem to be on WhatsApp, so we sent your code by SMS instead.' : 'We sent a new code by SMS.');
    } catch (e) {
      setError(firebaseErrorMessage(e) ?? errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // while waiting for a WhatsApp code: check every few seconds whether it was delivered, and switch to SMS if it failed
  useEffect(() => {
    if (step !== 'code' || via !== 'whatsapp') return;
    let stop = false;
    const t = setInterval(async () => {
      setTick((n) => n + 1);
      if (Date.now() - sentAt > 120_000) return;
      const s = await api.auth.otpStatus(phone).catch(() => null);
      if (!stop && s?.status === 'failed') {
        stop = true;
        clearInterval(t);
        void smsInstead(true);
      }
    }, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, via, sentAt]);
  const canSwitch = via === 'whatsapp' && (tick >= 3 || Date.now() - sentAt > 9000);

  const verify = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = via === 'sms'
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
        {step === 'phone' ? (
          <p className="mt-1 text-ink-soft">Log in or sign up with your mobile number.</p>
        ) : (
          <p className={`mt-3 inline-flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1 text-sm font-bold ${via === 'whatsapp' ? 'bg-[#DCF8C6]' : 'bg-lime-soft'}`}>
            {via === 'whatsapp' ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366]" aria-hidden>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.7-.1 1.5z" /></svg>
              </span>
            ) : (
              <span aria-hidden>✉️</span>
            )}
            {via === 'whatsapp' ? 'Code sent on WhatsApp ✓' : 'Code sent by SMS ✓'}
          </p>
        )}
        {invited && step === 'phone' && (
          <Callout tone="lime" title="🎁 You were invited!" className="mt-5">
            Sign up and you and your friend both get {formatINR(REFERRAL_REWARD)} wallet credit after your first booking.
          </Callout>
        )}
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            step === 'phone' ? send('whatsapp') : verify();
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
          {note && step === 'code' && (
            <Callout tone="sky" className="text-sm">
              {note}
            </Callout>
          )}
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
              <button type="button" className="underline" onClick={() => { setStep('phone'); setCode(''); setError(null); setNote(null); }}>
                Change number
              </button>
              <button type="button" className="underline disabled:no-underline disabled:opacity-50" disabled={cooldown > 0 || busy} onClick={() => (via === 'whatsapp' ? send('whatsapp') : smsInstead(false))}>
                {cooldown ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          )}
          {step === 'code' && canSwitch && (
            <p className="text-center text-sm">
              No WhatsApp on this number?{' '}
              <button type="button" className="font-bold underline disabled:opacity-50" disabled={busy} onClick={() => smsInstead(false)}>
                Send the code by SMS instead
              </button>
            </p>
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
