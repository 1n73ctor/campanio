'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ID_TYPES, formatINR, humanize } from '@companio/types';
import { Button, Callout, Card, Field, Input, Select } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader, PageHeader } from '@/components/misc';
import { useToast } from '@/components/toast';
import { errMsg } from '@/lib/format';
import { CompanionFeeSummary, useCompanionFee } from '@/components/companion-fee';

/**
 * Web KYC: ID upload + live selfie from the webcam (liveness-lite: must be captured live, not uploaded).
 * The native app replaces this with the device camera + an SDK liveness check.
 */
export default function KycPage() {
  const user = useRequireAuth({ companion: true });
  const { api, refresh } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [idType, setIdType] = useState<string>('AADHAAR');
  const [last4, setLast4] = useState('');
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const feePay = useCompanionFee();
  // only people whose earlier fee was refunded must pay again; companions from before the fee never do
  const feeBlocked = !!(feePay.fee?.due && feePay.fee.refundedAt);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  // attach the stream once the <video> is actually mounted
  useEffect(() => {
    if (camOn && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [camOn]);

  if (!user) return <FullLoader />;
  const status = user.companion?.kycStatus;

  const startCam = async () => {
    // getUserMedia only exists on secure origins (https:// or localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Camera needs a secure connection — open this page over https:// (or on localhost)', 'error');
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } } });
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
        setSelfie(b);
        setSelfieUrl(URL.createObjectURL(b));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setCamOn(false);
      },
      'image/jpeg',
      0.9,
    );
  };

  const submit = async () => {
    if (!idDoc || !selfie) return;
    setBusy(true);
    try {
      if (feeBlocked && !(await feePay.pay())) {
        setBusy(false);
        return;
      }
      await api.companion.submitKyc({ idType, idLast4: last4, idDoc, selfie: new File([selfie], 'selfie.jpg', { type: 'image/jpeg' }) });
      await refresh();
      toast('Submitted! We’ll review within 24h');
      router.push('/companion/dashboard');
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  if (status === 'PENDING' || status === 'APPROVED') {
    return (
      <div className="container-x max-w-xl py-12">
        <Callout tone={status === 'APPROVED' ? 'lime' : 'sunny'} title={status === 'APPROVED' ? 'You’re verified ✅' : 'Under review ⏳'}>
          {status === 'APPROVED' ? 'Nothing to do here.' : 'We’re reviewing your documents — usually within 24 hours.'}
        </Callout>
      </div>
    );
  }

  return (
    <div className="container-x max-w-2xl pb-10">
      <PageHeader eyebrow="Step 2 of 3" title="Verify your identity" subtitle="Your documents are encrypted, only seen by our verification team, and never shown to members." />
      <Card className="space-y-5 p-6">
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
        <div>
          <p className="mb-1.5 font-display text-sm font-bold">Live selfie</p>
          <div className="flex flex-col items-center gap-3 rounded-chunky border-3 border-dashed border-ink/40 bg-paper p-4">
            {camOn ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-sm -scale-x-100 rounded-chunky border-3 border-ink" />
                <Button onClick={capture}>📸 Capture</Button>
              </>
            ) : selfieUrl ? (
              <>
                <img src={selfieUrl} alt="Your selfie" className="w-full max-w-xs -scale-x-100 rounded-chunky border-3 border-ink" />
                <Button variant="white" size="sm" onClick={startCam}>
                  Retake
                </Button>
              </>
            ) : (
              <>
                <p className="text-center text-sm text-ink-soft">Good light, no sunglasses or masks. Face the camera straight on.</p>
                <Button variant="sky" onClick={startCam}>
                  Open camera
                </Button>
              </>
            )}
          </div>
        </div>
        {feeBlocked && <CompanionFeeSummary fee={feePay.fee} balance={feePay.balance} useWallet={feePay.useWallet} setUseWallet={feePay.setUseWallet} />}
        <Button size="lg" className="w-full" loading={busy} disabled={!idDoc || !selfie || last4.length !== 4} onClick={submit}>
          {feeBlocked && feePay.fee
            ? `Pay ${formatINR(feePay.fee.total - (feePay.useWallet ? Math.min(feePay.balance, feePay.fee.total) : 0))} & submit for verification`
            : 'Submit for verification'}
        </Button>
        {feePay.modal}
      </Card>
    </div>
  );
}
