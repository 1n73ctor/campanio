'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { Badge, Button, Callout, Card, Field, Input, Modal, StatusBadge, Textarea, cn } from '@companio/ui';
import { ErrorBox, Loading, PageTitle } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errMsg, useAdmin, useLoad } from '@/lib/api';
import { BOOKING_STATUS_LABEL, dt, formatINR, humanize } from '@/lib/format';

export default function AdminBooking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api } = useAdmin();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => api.admin.booking(id), [id]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const { booking: b, escrow, messages, payments, sos, locations } = data;
  const escrowActive = escrow && ['HELD', 'FROZEN'].includes(escrow.status);

  const refund = async () => {
    setBusy(true);
    try {
      const r = await api.admin.refund(b.id, note, amount ? Number(amount) : undefined);
      toast(`Refunded ${formatINR(r.amount)}`);
      setOpen(false);
      setNote('');
      setAmount('');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link href="/bookings" className="text-sm font-semibold underline">
        ← Bookings
      </Link>
      <PageTitle
        title={`${humanize(b.category)} · ${b.id.slice(-8)}`}
        subtitle={`${dt(b.startAt)} · ${b.hours}h · ${b.meetingPoint}`}
        actions={
          <>
            <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
            {b.status === 'DISPUTED' ? (
              <Link href="/disputes">
                <Button size="sm" variant="dark">Resolve dispute</Button>
              </Link>
            ) : (
              b.escrow && (
                <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
                  {escrowActive ? 'Refund & cancel' : 'Goodwill credit'}
                </Button>
              )
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="border-b-3 border-ink bg-lavender-soft px-5 py-3 font-display font-extrabold">Chat transcript ({messages.length})</div>
          <div className="max-h-[560px] space-y-2 overflow-y-auto p-4">
            {messages.length === 0 && <p className="text-sm text-ink-mute">No messages.</p>}
            {messages.map((m) => {
              const fromUser = m.senderId === b.user.id;
              return (
                <div key={m.id} className={cn('flex', fromUser ? 'justify-start' : 'justify-end')}>
                  <div className={cn('max-w-[80%] rounded-2xl border-2 border-ink px-3 py-2 text-sm', fromUser ? 'bg-white' : 'bg-pink-soft', m.hidden && 'opacity-60')}>
                    <p className="text-[11px] font-bold">{fromUser ? b.user.name : b.companion.name}</p>
                    <p>{m.body}</p>
                    <p className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-ink-mute">
                      {dt(m.createdAt)}
                      {m.flagReason && <Badge tone="sunny">{m.flagReason}</Badge>}
                      {m.hidden && <Badge tone="dark">hidden</Badge>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="space-y-1 p-5 text-sm">
            <h2 className="mb-2 font-display font-extrabold">Parties</h2>
            <p>
              Member:{' '}
              <Link className="font-bold underline" href={`/users/${b.user.id}`}>
                {b.user.name}
              </Link>{' '}
              · {b.user.phoneMasked}
            </p>
            <p>
              Companion:{' '}
              <Link className="font-bold underline" href={`/users/${b.companion.id}`}>
                {b.companion.name}
              </Link>{' '}
              · {b.companion.phoneMasked}
            </p>
            <p>Start code: <b className="font-mono">{b.startCode}</b></p>
            {b.note && <p>Note: “{b.note}”</p>}
            {b.cancelReason && <p>Cancel reason: {b.cancelReason}</p>}
          </Card>
          <Card className="space-y-1 p-5 text-sm">
            <h2 className="mb-2 font-display font-extrabold">Money</h2>
            <Row l="Subtotal" r={formatINR(b.subtotal)} />
            <Row l="Connection fee + GST" r={formatINR(b.connectionFee + b.gst)} />
            <Row l="Commission" r={formatINR(b.commission)} />
            <Row l="Companion payout" r={formatINR(b.companionPayout)} />
            <Row l="Total" r={formatINR(b.total)} bold />
            {escrow && (
              <div className="!mt-3 space-y-1 border-t-2 border-dashed border-ink/20 pt-3">
                <div className="flex justify-between">
                  <span>Escrow</span>
                  <StatusBadge status={escrow.status} />
                </div>
                <Row l="Refunded" r={formatINR(escrow.refunded)} />
                <Row l="Released" r={formatINR(escrow.released)} />
                <Row l="Retained (revenue)" r={formatINR(escrow.retained)} />
              </div>
            )}
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="mb-2 font-display font-extrabold">Payments</h2>
            {payments.length === 0 ? <p className="text-ink-mute">None</p> : payments.map((p) => (
              <div key={p.id} className="mb-2 border-b border-ink/10 pb-2 last:border-0">
                <p className="flex justify-between"><span>{p.provider} · {formatINR(p.amount)}{p.walletAmount ? ` + wallet ${formatINR(p.walletAmount)}` : ''}</span><StatusBadge status={p.status} /></p>
                <p className="font-mono text-[11px] text-ink-mute">{p.orderId}</p>
              </div>
            ))}
          </Card>
          {(sos.length > 0 || locations.length > 0) && (
            <Card tone="pink" className="p-5 text-sm">
              <h2 className="mb-2 font-display font-extrabold">Safety</h2>
              {sos.map((s) => (
                <p key={s.id}>🚨 {s.user.name} · {dt(s.createdAt)} · {s.status.toLowerCase()} {s.note && `— ${s.note}`}</p>
              ))}
              {locations.map((l) => (
                <p key={l.userId}>
                  📍 {l.userId === b.user.id ? b.user.name : b.companion.name}:{' '}
                  <a className="underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${l.lat},${l.lng}`}>{l.lat.toFixed(4)}, {l.lng.toFixed(4)}</a> · {dt(l.updatedAt)}
                </p>
              ))}
            </Card>
          )}
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={escrowActive ? 'Refund from escrow' : 'Goodwill credit'} footer={<Button variant="danger" loading={busy} disabled={note.trim().length < 3} onClick={refund}>Refund</Button>}>
        <Callout tone="sunny">{escrowActive ? 'This cancels the booking and refunds the member from escrow. The companion receives nothing.' : 'Escrow is already settled. This credits the member’s wallet from platform funds.'}</Callout>
        <Field label="Amount (₹)" hint={`Leave empty for ${escrowActive ? `the full ${formatINR(b.total)}` : `the booking amount ${formatINR(b.subtotal)}`}`}>
          <Input type="number" min={1} max={b.total} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Note (sent to member, logged)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}

const Row = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
  <div className={cn('flex justify-between', bold && 'font-display font-extrabold')}>
    <span>{l}</span>
    <span className="tabular-nums">{r}</span>
  </div>
);
