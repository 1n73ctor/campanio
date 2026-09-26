'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DisputeDto, DisputeOutcome } from '@companio/types';
import { Button, Callout, Card, Field, Input, Modal, StatusBadge, Tabs, Textarea, cn } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errMsg, useAdmin, useLoad } from '@/lib/api';
import { dt, formatINR, humanize } from '@/lib/format';

export default function DisputesPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad(() => api.admin.disputes({ status, page }), [status, page]);
  const [sel, setSel] = useState<DisputeDto | null>(null);
  const [outcome, setOutcome] = useState<DisputeOutcome>('SPLIT');
  const [refund, setRefund] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const b = sel?.booking;
  const preview = (() => {
    if (!b) return null;
    if (outcome === 'REFUND') return { refund: b.total, release: 0 };
    if (outcome === 'RELEASE') return { refund: 0, release: b.companionPayout };
    const r = Number(refund) || 0;
    const rem = b.subtotal - r;
    const pct = b.subtotal ? b.commission / b.subtotal : 0.15;
    return { refund: r, release: Math.max(0, rem - Math.round(rem * pct)) };
  })();

  const resolve = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const r = await api.admin.resolveDispute(sel.id, { outcome, refundAmount: outcome === 'SPLIT' ? Number(refund) : undefined, note });
      toast(`Resolved · refunded ${formatINR(r.refund)} · released ${formatINR(r.release)}`);
      setSel(null);
      setNote('');
      setRefund('');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Disputes" subtitle="Escrow is frozen until you decide. Read the chat on the booking page before resolving." actions={<Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: 'OPEN', label: 'Open' }, { value: 'RESOLVED', label: 'Resolved' }]} />} />
      {error && <ErrorBox error={error} />}
      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Card className="p-10 text-center text-ink-mute">No {status.toLowerCase()} disputes.</Card>
      ) : (
        <div className="space-y-4">
          {data.items.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-extrabold">{d.reason}</p>
                  <p className="text-sm text-ink-soft">
                    Raised by <b>{d.raisedBy.name}</b> · {dt(d.createdAt)}
                  </p>
                  <p className="mt-1 text-sm">
                    {d.booking.user.name} (member) ↔ {d.booking.companion.name} (companion) · {humanize(d.booking.category)} · {d.booking.hours}h · {formatINR(d.booking.total)}
                  </p>
                  {d.details && <p className="mt-2 rounded-chunky bg-paper p-3 text-sm">“{d.details}”</p>}
                  {d.status === 'RESOLVED' && (
                    <p className="mt-2 text-sm">
                      <b>{d.outcome}</b> · refunded {formatINR(d.refundAmount ?? 0)} · {d.resolutionNote}
                    </p>
                  )}
                </div>
                <StatusBadge status={d.status} />
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/bookings/${d.bookingId}`}>
                  <Button size="sm" variant="white">
                    Booking & chat
                  </Button>
                </Link>
                {d.status === 'OPEN' && (
                  <Button size="sm" variant="dark" onClick={() => { setSel(d); setOutcome('SPLIT'); setRefund(String(Math.round(d.booking.subtotal / 2))); }}>
                    Resolve
                  </Button>
                )}
              </div>
            </Card>
          ))}
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </div>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Resolve dispute" footer={<Button loading={busy} disabled={note.trim().length < 3} onClick={resolve}>Confirm resolution</Button>}>
        <div className="grid grid-cols-3 gap-2">
          {(['REFUND', 'SPLIT', 'RELEASE'] as const).map((o) => (
            <button key={o} onClick={() => setOutcome(o)} className={cn('rounded-chunky border-3 border-ink py-2 text-sm font-bold', outcome === o ? 'bg-ink text-paper' : 'bg-white')}>
              {o === 'REFUND' ? 'Full refund' : o === 'SPLIT' ? 'Split' : 'Pay companion'}
            </button>
          ))}
        </div>
        {outcome === 'SPLIT' && b && (
          <Field label="Refund to member (₹)" hint={`From the booking amount of ${formatINR(b.subtotal)}; fees are retained.`}>
            <Input type="number" min={1} max={b.subtotal - 1} value={refund} onChange={(e) => setRefund(e.target.value)} />
          </Field>
        )}
        {preview && (
          <Callout tone="sky" title="Settlement preview">
            Member gets <b>{formatINR(preview.refund)}</b> · Companion gets <b>{formatINR(preview.release)}</b>
          </Callout>
        )}
        <Field label="Resolution note (sent to both)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
