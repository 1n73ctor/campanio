'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { ageFromDob, cityBySlug, type UserStatus } from '@companio/types';
import { Avatar, Button, Card, Field, Input, Modal, Stat, StatusBadge } from '@companio/ui';
import { ErrorBox, Loading, PageTitle } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { BOOKING_STATUS_LABEL, d, dt, formatINR, humanize } from '@/admin/lib/format';

export default function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api } = useAdmin();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => api.admin.user(id), [id]);
  const [target, setTarget] = useState<Exclude<UserStatus, 'DELETED'> | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [refunding, setRefunding] = useState(false);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const u = data.user;

  return (
    <>
      <Link href="/admin/users" className="text-sm font-semibold underline">← Users</Link>
      <PageTitle
        title={u.name ?? 'Unnamed'}
        subtitle={`${u.phone ?? u.email ?? ''} · ${humanize(u.role)} · joined ${d(u.createdAt)}`}
        actions={
          <>
            <StatusBadge status={u.status} />
            {u.status !== 'DELETED' && (u.status === 'ACTIVE' ? (
              <>
                <Button size="sm" variant="sunny" onClick={() => setTarget('SUSPENDED')}>Suspend</Button>
                <Button size="sm" variant="danger" onClick={() => setTarget('BANNED')}>Ban</Button>
              </>
            ) : (
              <Button size="sm" variant="lime" onClick={() => setTarget('ACTIVE')}>Reactivate</Button>
            ))}
          </>
        }
      />
      {data.statusReason && <Card tone="pink" className="mb-4 p-3 text-sm">Status reason: {data.statusReason}</Card>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Bookings" value={u.bookingsCount} />
        <Stat label="Reports against" value={u.reportsAgainst} tone={u.reportsAgainst ? 'pink' : 'white'} />
        <Stat label="Warnings" value={data.warnings} tone={data.warnings ? 'sunny' : 'white'} />
        <Stat label="Wallet" value={formatINR(u.walletBalance)} tone="lime" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-2 p-5 text-sm">
          <div className="flex items-center gap-3">
            <Avatar name={u.name} src={u.avatarUrl} size={56} />
            <div>
              <p>Age {ageFromDob(u.dob) ?? '—'} · {u.gender ? humanize(u.gender) : '—'} · {cityBySlug(u.city ?? '')?.name ?? '—'}</p>
              <p className="text-ink-soft">{u.bio}</p>
            </div>
          </div>
          {u.companion && (
            <div className="border-t-2 border-dashed border-ink/20 pt-2">
              <p className="font-bold">Companion: “{u.companion.headline}”</p>
              <p>{formatINR(u.companion.hourlyRate)}/hr · ★ {u.companion.ratingAvg} ({u.companion.ratingCount}) · {u.companion.completedBookings} completed</p>
              <p>KYC <StatusBadge status={u.companion.kycStatus} /> · {u.companion.isListed ? 'listed' : 'not listed'}</p>
            </div>
          )}
          {u.companionFee?.paidAt && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-dashed border-ink/20 pt-2">
              <p>
                Registration fee <b>{formatINR(u.companionFee.paidAmount ?? 0)}</b> paid {d(u.companionFee.paidAt)}
                {u.companionFee.refundedAt && <> · <b>refunded</b> {d(u.companionFee.refundedAt)}</>}
              </p>
              {!u.companionFee.refundedAt && (
                <Button
                  size="sm"
                  variant="white"
                  loading={refunding}
                  onClick={async () => {
                    if (!confirm(`Refund ${formatINR(u.companionFee?.paidAmount ?? 0)} to ${u.name ?? 'this user'}'s wallet? They'll need to pay again to re-apply.`)) return;
                    setRefunding(true);
                    try {
                      await api.admin.refundCompanionFee(u.id);
                      toast('Fee refunded to their wallet');
                      reload();
                    } catch (e) {
                      toast(errMsg(e), 'error');
                    } finally {
                      setRefunding(false);
                    }
                  }}
                >
                  Refund to wallet
                </Button>
              )}
            </div>
          )}
        </Card>
        <Card className="p-5 text-sm">
          <h2 className="mb-2 font-display font-extrabold">Reports against</h2>
          {data.reports.length === 0 ? <p className="text-ink-mute">None</p> : data.reports.map((r) => (
            <p key={r.id} className="border-b border-ink/10 py-1.5">
              <b>{humanize(r.reason)}</b> by {r.reporter.name} · {d(r.createdAt)} · <StatusBadge status={r.status} />
              {r.details && <span className="block text-xs text-ink-soft">{r.details}</span>}
            </p>
          ))}
        </Card>
        <Card className="p-5 text-sm lg:col-span-2">
          <h2 className="mb-2 font-display font-extrabold">Recent bookings</h2>
          {data.bookings.length === 0 ? <p className="text-ink-mute">None</p> : (
            <ul className="divide-y divide-ink/10">
              {data.bookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/bookings/${b.id}`} className="underline">
                    {humanize(b.category)} · {b.user.id === u.id ? `booked ${b.companion.name}` : `booked by ${b.user.name}`} · {dt(b.startAt)}
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatINR(b.total)}</span>
                    <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5 text-sm lg:col-span-2">
          <h2 className="mb-2 font-display font-extrabold">Wallet ledger</h2>
          {data.wallet.length === 0 ? <p className="text-ink-mute">No transactions</p> : (
            <ul className="divide-y divide-ink/10">
              {data.wallet.map((t) => (
                <li key={t.id} className="flex justify-between py-1.5">
                  <span>{t.reason} <span className="text-xs text-ink-mute">· {dt(t.createdAt)}</span></span>
                  <span className="tabular-nums">{t.type === 'CREDIT' ? '+' : '−'}{formatINR(t.amount)} → {formatINR(t.balanceAfter)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={target === 'ACTIVE' ? 'Reactivate account' : target === 'BANNED' ? 'Ban account' : 'Suspend account'}
        footer={
          <Button
            variant={target === 'BANNED' ? 'danger' : 'primary'}
            loading={busy}
            disabled={target !== 'ACTIVE' && reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                await api.admin.setUserStatus(id, target!, reason || undefined);
                toast('Status updated');
                setTarget(null);
                setReason('');
                reload();
              } catch (e) {
                toast(errMsg(e), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm
          </Button>
        }
      >
        {target !== 'ACTIVE' && <p className="text-sm">The user is signed out of all devices and their companion listing is hidden.</p>}
        <Field label="Reason (logged)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
