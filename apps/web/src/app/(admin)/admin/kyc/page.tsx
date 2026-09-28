'use client';

import { useState } from 'react';
import { ageFromDob, cityBySlug, formatINR, humanize, type KycChecksDto, type KycFlag } from '@companio/types';
import { Badge, Button, Callout, Card, Checkbox, Field, Modal, StatusBadge, Tabs, Textarea } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { dt } from '@/admin/lib/format';

const FLAG: Record<KycFlag, { text: string; serious: boolean }> = {
  BANNED_IDENTITY: { text: 'Same Aadhaar as a banned or suspended account', serious: true },
  GENDER_MISMATCH: { text: 'Gender on Aadhaar differs from the profile — matters for women-only bookings', serious: true },
  FACE_MISMATCH: { text: 'Selfie doesn’t look like the ID photo', serious: true },
  LIVENESS_FAILED: { text: 'Selfie may not be a live person (photo of a photo, screen or mask?)', serious: true },
  DUPLICATE_IDENTITY: { text: 'Same Aadhaar is already on another account', serious: false },
  NAME_MISMATCH: { text: 'Profile name doesn’t match the name on Aadhaar', serious: false },
  DOB_MISMATCH: { text: 'Profile date of birth differs from Aadhaar', serious: false },
  ID_PHOTO_NOT_COMPARED: { text: 'ID photo couldn’t be compared automatically (PDF or unclear) — compare by eye', serious: false },
  CHECKS_UNAVAILABLE: { text: 'Automatic checks didn’t run (verification service unreachable) — review by eye', serious: false },
};

const pct = (n: number | null) => (n === null ? '' : ` ${Math.round(n * 100)}%`);

function Checks({ c }: { c: KycChecksDto }) {
  // submissions from before automatic checks existed (or with them switched off): nothing to show
  if (!c.verified && c.livenessPassed === null && c.faceMatched === null && c.flags.length === 0) return null;
  const result = (label: string, ok: boolean | null, score: number | null) => (
    <Badge tone={ok === null ? 'white' : ok ? 'lime' : 'danger'}>
      {label}: {ok === null ? 'not run' : ok ? `✓${pct(score)}` : `✗${pct(score)}`}
    </Badge>
  );
  return (
    <div className="mt-3 space-y-2 rounded-chunky border-2 border-ink/20 bg-paper p-3 text-sm">
      {c.verified && (
        <p>
          <b>Aadhaar record:</b> {c.verified.name} · {c.verified.dob ? `born ${c.verified.dob} (age ${ageFromDob(c.verified.dob)})` : 'DOB not on record'}
          {c.verified.gender && ` · ${humanize(c.verified.gender)}`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {result('Live person', c.livenessPassed, c.livenessScore)}
        {result('Face match', c.faceMatched, c.faceMatchScore)}
      </div>
      {c.flags.length > 0 ? (
        <ul className="space-y-1">
          {c.flags.map((f) => (
            <li key={f} className={FLAG[f].serious ? 'font-bold text-danger' : ''}>
              ⚠️ {FLAG[f].text}
            </li>
          ))}
        </ul>
      ) : (
        c.livenessPassed !== null && <p className="text-ink-soft">No warnings from the automatic checks.</p>
      )}
    </div>
  );
}

export default function KycPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad(() => api.admin.kyc({ status, page }), [status, page]);
  const { data: checks } = useLoad(() => api.admin.kycChecks().catch(() => null), []);
  const [reject, setReject] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [refundFee, setRefundFee] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const rejectFee = data?.items.find((k) => k.id === reject)?.fee;

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      approve ? await api.admin.approveKyc(id) : await api.admin.rejectKyc(id, note, refundFee);
      toast(approve ? 'Approved — companion is live' : refundFee ? 'Rejected and fee refunded to their wallet' : 'Rejected');
      setReject(null);
      setNote('');
      setRefundFee(false);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle
        title="Companion verification"
        subtitle="DigiLocker submissions come straight from the government record — check the warnings and that the selfie is the Aadhaar photo. Uploaded IDs: also check the document isn’t edited or expired, the name matches and DOB shows 18+."
        actions={<Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }]} />}
      />
      {(checks?.mode === 'sandbox' || checks?.mode === 'demo') && (
        <Callout tone="sunny" title={checks.mode === 'sandbox' ? 'Test mode (Cashfree sandbox)' : 'Local demo mode'} className="mb-5">
          DigiLocker details and face scores below are {checks.mode === 'sandbox' ? 'test data from the sandbox' : 'made up on this computer'} — they don’t prove anyone’s
          identity. Check every submission by eye.
        </Callout>
      )}
      {error && <ErrorBox error={error} />}
      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Card className="p-10 text-center text-ink-mute">Queue is empty 🎉</Card>
      ) : (
        <div className="space-y-5">
          {data.items.map((k) => {
            const age = ageFromDob(k.companion?.dob);
            return (
              <Card key={k.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-extrabold">{k.userName}</p>
                    <p className="text-sm text-ink-soft">
                      {k.userPhone} · {cityBySlug(k.companion?.city ?? '')?.name} · age {age ?? '?'} {age !== null && age < 18 && <b className="text-danger">UNDER 18</b>}
                    </p>
                    <p className="text-sm">“{k.companion?.headline}”</p>
                    <p className="mt-1 text-xs text-ink-mute">
                      {humanize(k.idType)} ending {k.idLast4} · submitted {dt(k.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={k.method === 'DIGILOCKER' ? 'lime' : 'white'}>{k.method === 'DIGILOCKER' ? '🪪 Aadhaar via DigiLocker' : '📎 Uploaded ID'}</Badge>
                      {k.checks?.autoApproved && <Badge tone="sky">Approved automatically</Badge>}
                    </div>
                    {k.fee?.paidAt && (
                      <Badge tone={k.fee.refundedAt ? 'white' : 'lime'} className="mt-2">
                        {k.fee.refundedAt ? `Fee ${formatINR(k.fee.paidAmount ?? 0)} refunded` : `Registration fee paid · ${formatINR(k.fee.paidAmount ?? 0)}`}
                      </Badge>
                    )}
                  </div>
                  <StatusBadge status={k.status} />
                </div>
                {k.checks && <Checks c={k.checks} />}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <figure>
                    <figcaption className="mb-1 text-xs font-bold uppercase">{k.method === 'DIGILOCKER' ? 'Photo on Aadhaar (DigiLocker)' : 'ID document'}</figcaption>
                    <a href={k.idDocUrl} target="_blank" rel="noreferrer">
                      <img src={k.idDocUrl} alt="ID document" className="max-h-72 w-full rounded-chunky border-3 border-ink bg-paper object-contain" />
                    </a>
                  </figure>
                  <figure>
                    <figcaption className="mb-1 text-xs font-bold uppercase">Live selfie</figcaption>
                    <a href={k.selfieUrl} target="_blank" rel="noreferrer">
                      <img src={k.selfieUrl} alt="Selfie" className="max-h-72 w-full rounded-chunky border-3 border-ink bg-paper object-contain" />
                    </a>
                  </figure>
                </div>
                {k.reviewNote && <p className="mt-3 text-sm">Note: {k.reviewNote}</p>}
                {k.status === 'PENDING' && (
                  <div className="mt-4 flex gap-2">
                    <Button variant="lime" loading={busy === k.id} onClick={() => decide(k.id, true)}>
                      ✅ Approve & list
                    </Button>
                    <Button variant="white" onClick={() => setReject(k.id)}>
                      Reject
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </div>
      )}
      <Modal open={!!reject} onClose={() => { setReject(null); setRefundFee(false); }} title="Reject verification" footer={<Button variant="danger" loading={busy === reject} disabled={note.trim().length < 3} onClick={() => decide(reject!, false)}>Reject</Button>}>
        <Field label="Reason (sent to the companion)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="The ID photo is blurry — please upload a clearer image with all corners visible." />
        </Field>
        {rejectFee?.paidAt && !rejectFee.refundedAt && (
          <Checkbox
            checked={refundFee}
            onChange={(e) => setRefundFee(e.target.checked)}
            label={<>Refund their <b>{formatINR(rejectFee.paidAmount ?? 0)}</b> registration fee to their wallet. If refunded, they must pay again to re-apply.</>}
          />
        )}
      </Modal>
    </>
  );
}
