'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ID_TYPES, formatINR, humanize, type DigilockerIdentityDto, type KycOptionsDto } from '@companio/types';
import { Button, Callout, Card, Field, Input, Select } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader, PageHeader } from '@/components/misc';
import { useToast } from '@/components/toast';
import { errMsg, fmtDate } from '@/lib/format';
import { CompanionFeeSummary, useCompanionFee } from '@/components/companion-fee';

/** set just before leaving for DigiLocker, so we know to fetch the result when the companion comes back */
const DL_PENDING = 'companio.dl.pending';

/**
 * Companion ID verification.
 *  - DigiLocker (when the API has it set up): share Aadhaar from DigiLocker, then a live selfie. The API checks the
 *    selfie is a live person and matches the Aadhaar photo.
 *  - Manual fallback: photo of an ID + live selfie, reviewed by an admin.
 * The selfie must come from the camera here, never a file.
 */
export default function KycPage() {
  const user = useRequireAuth({ companion: true });
  const { api, refresh } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [options, setOptions] = useState<KycOptionsDto | null>(null);
  const [mode, setMode] = useState<'digilocker' | 'manual'>('digilocker');
  const [identity, setIdentity] = useState<DigilockerIdentityDto | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);
  const [idType, setIdType] = useState<string>('AADHAAR');
  const [last4, setLast4] = useState('');
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const feePay = useCompanionFee();
  // only people whose earlier fee was refunded must pay again; companions from before the fee never do
  const feeBlocked = !!(feePay.fee?.due && feePay.fee.refundedAt);
  const status = user?.companion?.kycStatus;
  const open = !!user && status !== 'PENDING' && status !== 'APPROVED';

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let o: KycOptionsDto = { mode: 'off', digilocker: false, faceChecks: false };
      try {
        o = await api.companion.kycOptions();
      } catch {
        /* older API without DigiLocker: manual upload */
      }
      if (cancelled) return;
      setOptions(o);
      if (!o.digilocker) return setMode('manual');
      let returning = new URLSearchParams(window.location.search).has('dl');
      try {
        returning ||= sessionStorage.getItem(DL_PENDING) === '1';
        sessionStorage.removeItem(DL_PENDING);
      } catch {
        /* storage blocked */
      }
      if (returning) {
        router.replace('/companion/kyc');
        setDlBusy(true);
        try {
          const id = await api.companion.completeDigilocker();
          if (!cancelled) setIdentity(id);
        } catch (e) {
          if (!cancelled) setDlError(errMsg(e));
        } finally {
          if (!cancelled) setDlBusy(false);
        }
      } else {
        const id = await api.companion.currentDigilocker().catch(() => null);
        if (!cancelled) setIdentity(id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!user) return <FullLoader />;

  if (!open) {
    return (
      <div className="container-x max-w-xl py-12">
        <Callout tone={status === 'APPROVED' ? 'lime' : 'sunny'} title={status === 'APPROVED' ? 'You’re verified ✅' : 'Under review ⏳'}>
          {status === 'APPROVED' ? 'Nothing to do here.' : 'We’re reviewing your documents — usually within 24 hours.'}
        </Callout>
      </div>
    );
  }
  if (!options) return <FullLoader />;

  const startDigilocker = async () => {
    setDlBusy(true);
    setDlError(null);
    try {
      const { url } = await api.companion.startDigilocker();
      try {
        sessionStorage.setItem(DL_PENDING, '1');
      } catch {
        /* the ?dl=1 on the return link still works */
      }
      window.location.assign(url);
    } catch (e) {
      setDlError(errMsg(e));
      setDlBusy(false);
    }
  };

  const notMe = async () => {
    setIdentity(null);
    await api.companion.discardDigilocker().catch(() => undefined);
  };

  const ready = mode === 'digilocker' ? !!identity && !!selfie : !!idDoc && !!selfie && last4.length === 4;

  const submit = async () => {
    if (!ready || !selfie) return;
    setBusy(true);
    try {
      if (feeBlocked && !(await feePay.pay())) {
        setBusy(false);
        return;
      }
      const photo = new File([selfie], 'selfie.jpg', { type: 'image/jpeg' });
      const k =
        mode === 'digilocker'
          ? await api.companion.submitKyc({ method: 'DIGILOCKER', selfie: photo })
          : await api.companion.submitKyc({ idType, idLast4: last4, idDoc: idDoc!, selfie: photo });
      await refresh();
      toast(k.status === 'APPROVED' ? 'You’re verified ✅ and live!' : 'Submitted! We’ll review within 24h');
      router.push('/companion/dashboard');
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="container-x max-w-2xl pb-10">
      <PageHeader eyebrow="Step 2 of 3" title="Verify your identity" subtitle="Your details are encrypted, only seen by our verification team, and never shown to members." />
      <Card className="space-y-6 p-6">
        {mode === 'digilocker' ? (
          <section>
            <p className="mb-1.5 font-display text-sm font-bold">1 · Aadhaar via DigiLocker</p>
            {identity ? (
              <div className="rounded-chunky border-3 border-ink bg-lime/40 p-4">
                <p className="font-display font-extrabold">✅ Aadhaar verified</p>
                <p className="mt-1 text-sm">
                  <b>{identity.name}</b>
                  {identity.dob && <> · born {fmtDate(identity.dob)}</>}
                  {identity.gender && <> · {humanize(identity.gender)}</>}
                  <> · Aadhaar XXXX XXXX {identity.last4}</>
                </p>
                <button type="button" onClick={notMe} className="mt-2 text-xs font-bold underline">
                  Not you? Start again
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-chunky border-3 border-dashed border-ink/40 bg-paper p-4">
                <p className="text-sm text-ink-soft">
                  Sign in to DigiLocker with your Aadhaar-linked mobile number and tap <b>Allow</b>. It takes about a minute, and there’s nothing to upload. We keep
                  your name, date of birth, gender, photo and the last 4 digits of your Aadhaar — never the full number or your address.
                </p>
                {dlError && <p className="text-sm font-bold text-danger">{dlError}</p>}
                <Button variant="sky" loading={dlBusy} onClick={startDigilocker}>
                  {dlError ? 'Try DigiLocker again' : 'Verify with DigiLocker'}
                </Button>
              </div>
            )}
            {!identity && (
              <button type="button" className="mt-3 text-sm font-bold underline" onClick={() => setMode('manual')}>
                No DigiLocker? Upload a photo of your ID instead
              </button>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            {options.digilocker && (
              <Callout tone="sky" title="Faster with DigiLocker">
                Verifying with DigiLocker usually gets you live straight away.{' '}
                <button type="button" className="font-bold underline" onClick={() => setMode('digilocker')}>
                  Use DigiLocker instead
                </button>
              </Callout>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ID type">
                <Select value={idType} onChange={(e) => setIdType(e.target.value)}>
                  {ID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {humanize(t)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Last 4 characters of ID number">
                <Input value={last4} onChange={(e) => setLast4(e.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase())} placeholder="1234" />
              </Field>
            </div>
            <Field label="Photo of your ID (front)" hint="JPG, PNG or PDF, max 5MB. Make sure all four corners are visible.">
              <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="pt-2" onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)} />
            </Field>
          </section>
        )}

        <section>
          <p className="mb-1.5 font-display text-sm font-bold">{mode === 'digilocker' ? '2 · Live selfie' : 'Live selfie'}</p>
          <LiveSelfie onChange={setSelfie} hint={options.faceChecks ? 'We check it’s really you, live — so no photos of photos or screens.' : undefined} />
        </section>

        {feeBlocked && <CompanionFeeSummary fee={feePay.fee} balance={feePay.balance} useWallet={feePay.useWallet} setUseWallet={feePay.setUseWallet} />}
        <Button size="lg" className="w-full" loading={busy} disabled={!ready} onClick={submit}>
          {feeBlocked && feePay.fee
            ? `Pay ${formatINR(feePay.fee.total - (feePay.useWallet ? Math.min(feePay.balance, feePay.fee.total) : 0))} & submit for verification`
            : 'Submit for verification'}
        </Button>
        {feePay.modal}
      </Card>
    </div>
  );
}

/** Webcam selfie: must be captured live here (no file picker). Reports the captured JPEG, or null on retake. */
function LiveSelfie({ onChange, hint }: { onChange: (b: Blob | null) => void; hint?: string }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);
  // attach the stream once the <video> is actually mounted
  useEffect(() => {
    if (camOn && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [camOn]);

  const start = async () => {
    // getUserMedia only exists on secure origins (https:// or localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Camera needs a secure connection — open this page over https:// (or on localhost)', 'error');
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } } });
      onChange(null);
      setCamOn(true);
    } catch (e) {
      const name = (e as DOMException)?.name;
      toast(
        name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'No camera found on this device'
          : name === 'NotReadableError'
            ? 'Your camera is in use by another app — close it and try again'
            : 'Camera permission is needed for the live selfie — allow it in your browser’s site settings',
        'error',
      );
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      toast('Camera is still starting — try again in a second', 'error');
      return;
    }
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (!b) {
          toast('Couldn’t capture the photo — please try again', 'error');
          return;
        }
        onChange(b);
        setUrl(URL.createObjectURL(b));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setCamOn(false);
      },
      'image/jpeg',
      0.9,
    );
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-chunky border-3 border-dashed border-ink/40 bg-paper p-4">
      {camOn ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-sm -scale-x-100 rounded-chunky border-3 border-ink" />
          <Button onClick={capture}>📸 Capture</Button>
        </>
      ) : url ? (
        <>
          <img src={url} alt="Your selfie" className="w-full max-w-xs -scale-x-100 rounded-chunky border-3 border-ink" />
          <Button variant="white" size="sm" onClick={start}>
            Retake
          </Button>
        </>
      ) : (
        <>
          <p className="text-center text-sm text-ink-soft">
            Good light, no sunglasses or masks. Face the camera straight on, alone in the frame.
            {hint && <span className="mt-1 block">{hint}</span>}
          </p>
          <Button variant="sky" onClick={start}>
            Open camera
          </Button>
        </>
      )}
    </div>
  );
}
