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
  NAME_MISMATCH: { text: 'The name they typed doesn’t match the name on Aadhaar', serious: false },
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
  // by-eye checks per submission (uploaded IDs): all ticked before Approve unlocks
  const [ticks, setTicks] = useState<Record<string, Record<string, boolean>>>({});

  const rejectFee = data?.items.find((k) => k.id === reject)?.fee;

  const decide = async (id: string, approve: boolean, closeNote?: string) => {
    setBusy(id);
    try {
      if (closeNote) await api.admin.rejectKyc(id, closeNote, false);
      else approve ? await api.admin.approveKyc(id, undefined, ticks[id]) : await api.admin.rejectKyc(id, note, refundFee);
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
                    <p className="flex flex-wrap items-center gap-2 font-display text-xl font-extrabold">
                      {k.userName}
                      <AccountBadge status={k.account?.status} />
                    </p>
                    <p className="text-sm text-ink-soft">
                      {k.userPhone ?? (k.account?.deletedPhone ? `${k.account.deletedPhone} (deleted)` : '—')} · {cityBySlug(k.companion?.city ?? '')?.name} · age {age ?? '?'}{' '}
                      {age !== null && age < 18 && <b className="text-danger">UNDER 18</b>}
                    </p>
                    <p className="text-sm">“{k.companion?.headline}”</p>
                    <p className="mt-2 inline-block rounded-chunky border-2 border-ink bg-sunny-soft px-2.5 py-1 text-sm">
                      🪪 Name on ID (typed): {k.legalName ? <b>{k.legalName}</b> : <span className="text-ink-mute">not given — compare with the profile name</span>}
                    </p>
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
                {k.account && k.account.status !== 'ACTIVE' && (
                  <Callout tone="pink" className="mt-3">
                    <b>{k.account.status === 'DELETED' ? `🗑 Account deleted${k.account.deletedAt ? ` on ${dt(k.account.deletedAt)}` : ''}` : `This account is ${k.account.status.toLowerCase()}`}</b> —
                    it can’t be approved.
                  </Callout>
                )}
                {k.checks && <Checks c={k.checks} />}
                {k.account && <Compare a={k.account} idType={k.idType} idLast4={k.idLast4} digilocker={k.method === 'DIGILOCKER'} />}
                <div className={`mt-4 grid gap-4 ${k.idDocBackUrl ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  <Doc url={k.idDocUrl} label={k.method === 'DIGILOCKER' ? 'Photo on Aadhaar (DigiLocker)' : k.idDocBackUrl ? 'ID — front' : 'ID document'} />
                  {k.idDocBackUrl && <Doc url={k.idDocBackUrl} label="ID — back" />}
                  <figure>
                    <figcaption className="mb-1 text-xs font-bold uppercase">Live selfie</figcaption>
                    <a href={k.selfieUrl} target="_blank" rel="noreferrer">
                      <img src={k.selfieUrl} alt="Selfie" className="max-h-72 w-full rounded-chunky border-3 border-ink bg-paper object-contain" />
                    </a>
                  </figure>
                </div>
                {k.reviewNote && <p className="mt-3 text-sm">Note: {k.reviewNote}</p>}
                {k.status === 'PENDING' && k.account && k.account.status !== 'ACTIVE' ? (
                  <div className="mt-4">
                    <Button variant="white" loading={busy === k.id} onClick={() => decide(k.id, false, k.account?.status === 'DELETED' ? 'Account deleted by the user' : `Account ${k.account?.status.toLowerCase()}`)}>
                      Close — account {k.account.status === 'DELETED' ? 'deleted' : k.account.status.toLowerCase()}
                    </Button>
                  </div>
                ) : (
                  k.status === 'PENDING' && (
                    <>
                      {k.method !== 'DIGILOCKER' && (
                        <div className="mt-4 rounded-chunky border-2 border-ink bg-sunny-soft p-3">
                          <p className="mb-2 text-sm font-bold">Check by eye against the ID, then approve:</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {CHECKS.map(([key, label]) => (
                              <Checkbox
                                key={key}
                                checked={!!ticks[k.id]?.[key]}
                                onChange={(e) => setTicks((t) => ({ ...t, [k.id]: { ...t[k.id], [key]: e.target.checked } }))}
                                label={label}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          variant="lime"
                          loading={busy === k.id}
                          disabled={k.method !== 'DIGILOCKER' && !CHECKS.every(([key]) => ticks[k.id]?.[key])}
                          onClick={() => decide(k.id, true)}
                        >
                          ✅ Approve & list
                        </Button>
                        <Button variant="white" onClick={() => setReject(k.id)}>
                          Reject
                        </Button>
                        {k.method !== 'DIGILOCKER' && !CHECKS.every(([key]) => ticks[k.id]?.[key]) && <span className="text-xs text-ink-mute">Tick all four checks to approve</span>}
                      </div>
                    </>
                  )
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

/** An uploaded ID side: images inline, PDFs as a link (a browser can't show a PDF in an <img>). */
function Doc({ url, label }: { url: string; label: string }) {
  const pdf = /\.pdf(\?|$)/i.test(url);
  return (
    <figure>
      <figcaption className="mb-1 text-xs font-bold uppercase">{label}</figcaption>
      <a href={url} target="_blank" rel="noreferrer">
        {pdf ? (
          <span className="flex h-40 items-center justify-center rounded-chunky border-3 border-ink bg-paper font-bold underline">📄 Open PDF</span>
        ) : (
          <img src={url} alt={label} className="max-h-72 w-full rounded-chunky border-3 border-ink bg-paper object-contain" />
        )}
      </a>
    </figure>
  );
}

const CHECKS: [string, string][] = [
  ['name', 'Name on the ID matches the name they typed (profile name can be a short name)'],
  ['dob', 'Date of birth matches, and they’re 18+'],
  ['gender', 'Gender matches (it decides women-only bookings)'],
  ['face', 'The selfie is the same person as the ID photo'],
];

function AccountBadge({ status }: { status?: string }) {
  if (!status) return null;
  const tone = status === 'ACTIVE' ? 'bg-lime' : status === 'DELETED' ? 'bg-ink text-white' : 'bg-danger text-white';
  const label = status === 'ACTIVE' ? 'Active account' : status === 'DELETED' ? '🗑 Deleted' : status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`rounded-full border-2 border-ink px-2 py-0.5 font-sans text-xs font-bold ${tone}`}>{label}</span>;
}

/** What they entered on their profile — what the ID has to match. */
function Compare({ a, idType, idLast4, digilocker }: { a: NonNullable<import('@companio/api-client').AdminKyc['account']>; idType: string; idLast4: string; digilocker: boolean }) {
  const age = ageFromDob(a.dob);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-ink-mute">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
  return (
    <div className="mt-3 rounded-chunky border-2 border-ink/20 bg-white p-3 text-sm">
      <p className="mb-1.5 text-xs font-bold uppercase text-ink-mute">{digilocker ? 'Their profile (compare with the Aadhaar record above)' : 'Their profile — the ID must match this'}</p>
      <div className="grid gap-1 sm:grid-cols-2">
        {row('Name', a.name ?? '—')}
        {row('Date of birth', a.dob ? `${new Date(a.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (age ${age ?? '?'})` : '— not given')}
        {row('Gender', a.gender ? humanize(a.gender) : '— not given')}
        {row('City', cityBySlug(a.city ?? '')?.name ?? '—')}
        {row('ID', `${humanize(idType)} ending ${idLast4}`)}
      </div>
    </div>
  );
}

