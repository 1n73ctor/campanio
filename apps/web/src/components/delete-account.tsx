'use client';

import { useRef, useState } from 'react';
import { formatINR } from '@companio/types';
import { Button, Callout, Card, Field, Input, Modal } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { FIREBASE_ENABLED, confirmFirebaseCode, firebaseErrorMessage, sendFirebaseCode } from '@/lib/firebase-phone';
import { useToast } from './toast';

type Step = 'warn' | 'code' | 'final';
const ACTIVE = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED'];

/**
 * Account deletion in three steps so nobody deletes by accident:
 *   1. what they'll lose  →  2. confirm it's them with a fresh login code  →  3. a last "are you sure?"
 * The account is hidden from everyone and can't sign in; admins keep the record for safety.
 */
export function DeleteAccount() {
  const { api, user } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<Step | null>(null);
  const [balance, setBalance] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const phone10 = user?.phone?.slice(-10) ?? '';

  const close = () => {
    setStep(null);
    setCode('');
    setDevCode(null);
    setDeleteToken(null);
    setError(null);
  };

  const open = async () => {
    setStep('warn');
    const [w, asMember, asCompanion] = await Promise.all([
      api.wallet.get().catch(() => ({ balance: 0 })),
      api.bookings.list({ as: 'user', scope: 'all' }).catch(() => []),
      user?.companion ? api.bookings.list({ as: 'companion', scope: 'all' }).catch(() => []) : Promise.resolve([]),
    ]);
    setBalance(w.balance);
    setActiveCount([...asMember, ...asCompanion].filter((b) => ACTIVE.includes(b.status)).length);
  };

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      if (FIREBASE_ENABLED) await sendFirebaseCode(phone10, recaptchaRef.current!);
      else setDevCode((await api.auth.requestOtp(phone10)).devCode ?? null);
      setStep('code');
    } catch (e) {
      setError(firebaseErrorMessage(e) ?? errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const checkCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const proof = FIREBASE_ENABLED ? { idToken: await confirmFirebaseCode(code) } : { code };
      setDeleteToken((await api.me.confirmDelete(proof)).deleteToken);
      setStep('final');
    } catch (e) {
      setError(firebaseErrorMessage(e) ?? errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteNow = async () => {
    if (!deleteToken) return;
    setBusy(true);
    try {
      await api.me.deleteAccount(deleteToken);
      // full page load to the home page: signing out in place would first bounce this page to /login
      try {
        localStorage.removeItem('companio.token');
        sessionStorage.setItem('companio.flash', 'Your account has been deleted. Take care!');
      } catch {}
      window.location.replace('/');
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <Card tone="pink" className="mt-6 p-6">
        <h2 className="font-display text-lg font-extrabold">Delete account</h2>
        <p className="mt-1 text-sm text-ink-soft">Closes your account. We’ll confirm it’s you with a code before anything happens.</p>
        <Button variant="danger" className="mt-4" onClick={open}>
          Delete my account
        </Button>
      </Card>

      <Modal open={step !== null} onClose={close} title={step === 'final' ? 'Are you sure?' : 'Delete your account'}>
        {/* Firebase's invisible reCAPTCHA mounts here when sending the code */}
        <div ref={recaptchaRef} />

        {step === 'warn' && (
          <>
            <ul className="space-y-2 text-sm">
              <li>🙈 Your profile disappears and you’ll be signed out everywhere.</li>
              <li>💬 Your chats and meetup history close for good.</li>
              {user?.companion && <li>📉 Your host listing, ratings and earnings history go with it.</li>}
              <li>🛡️ For everyone’s safety, we keep a private record of your account, meetups and reports. Only our trust & safety team can see it.</li>
              <li>📱 You can sign up again later with the same number, but as a brand-new account.</li>
            </ul>
            {balance > 0 && (
              <Callout tone="sunny" title={`You have ${formatINR(balance)} in your wallet`}>
                It will be lost when you delete your account.{user?.companion ? ' Withdraw what you can to UPI first from your Wallet page (credit can only be used on meetups).' : ' Use it on a meetup first.'}
              </Callout>
            )}
            {activeCount > 0 && (
              <Callout tone="pink" title={`You have ${activeCount} active meetup${activeCount > 1 ? 's' : ''}`}>
                Finish or cancel your active bookings before deleting your account.
              </Callout>
            )}
            {error && <p className="text-sm font-semibold text-danger">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="lime" size="lg" className="flex-1" onClick={close}>
                Keep my account
              </Button>
              <Button variant="white" size="lg" className="flex-1" loading={busy} disabled={activeCount > 0 || !phone10} onClick={sendCode}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 'code' && (
          <>
            <p className="text-sm">To make sure it’s really you, we sent a 6-digit code to +91 {phone10}.</p>
            <Field label="Code" error={error}>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                className="text-center font-display text-2xl tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
            </Field>
            {devCode && (
              <Callout tone="lavender" title="Dev mode">
                Your code is <b className="font-mono">{devCode}</b>.
              </Callout>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="lime" size="lg" className="flex-1" onClick={close}>
                Keep my account
              </Button>
              <Button variant="white" size="lg" className="flex-1" loading={busy} disabled={code.length !== 6} onClick={checkCode}>
                Confirm code
              </Button>
            </div>
          </>
        )}

        {step === 'final' && (
          <>
            <p>This is the last step. Once deleted, your account can’t be restored.</p>
            <p className="text-sm text-ink-soft">Changed your mind? No problem — nothing has been deleted yet.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="lime" size="lg" className="flex-1" onClick={close}>
                No, keep my account
              </Button>
              <Button variant="white" size="lg" className="flex-1 !text-danger" loading={busy} onClick={deleteNow}>
                Yes, delete
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
