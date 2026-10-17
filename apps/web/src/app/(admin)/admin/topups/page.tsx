'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdminTopUpDto } from '@companio/types';
import { Button, Callout, Field, Input, Modal, Select } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { dtIST, formatINR } from '@/admin/lib/format';

const STATUS: Record<string, string> = { PENDING: '⏳ Says paid', STARTED: 'QR shown, not confirmed', APPROVED: '✅ Coins added', REJECTED: '❌ Rejected' };

/** Coin top-ups paid to the UPI QR: check each one in the UPI app, then add the coins or reject it. */
export default function TopUpsPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad(() => api.admin.topups({ status, page }), [status, page]);
  const [approving, setApproving] = useState<AdminTopUpDto | null>(null);
  const [rejecting, setRejecting] = useState<AdminTopUpDto | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      setApproving(null);
      setRejecting(null);
      setNote('');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Coin top-ups" subtitle="Members paying the UPI QR. Find each payment in your UPI app (amount + note with the code), then add the coins." />
      <Callout tone="sunny" className="mb-4">
        Only approve once you can see the money in your UPI app. Match the <b>amount</b> and the <b>code in the note</b> (e.g. CMP-7KQ2), and the
        transaction ID if they gave one. Coins are added straight to their wallet and logged in the audit log.
      </Callout>
      <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="mb-4 max-w-64" aria-label="Show">
        <option value="PENDING">Waiting for you (says paid)</option>
        <option value="STARTED">QR shown, not confirmed yet</option>
        <option value="APPROVED">Coins added</option>
        <option value="REJECTED">Rejected</option>
        <option value="ALL">All</option>
      </Select>
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <Table head={['When (IST)', 'Member', 'Amount', 'Note to look for', 'UPI txn ID', 'Status', '']} empty={data.items.length === 0}>
            {data.items.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-xs">
                  {dtIST(r.createdAt)}
                  {r.submittedAt && <span className="block text-ink-mute">paid {dtIST(r.submittedAt)}</span>}
                </Td>
                <Td>
                  <Link href={`/admin/users/${r.user.id}`} className="font-bold underline">{r.user.name ?? '—'}</Link>
                  <span className="block text-xs text-ink-mute">{r.user.phone}</span>
                </Td>
                <Td className="font-bold tabular-nums">{formatINR(r.amount)}</Td>
                <Td className="whitespace-nowrap font-mono text-sm font-bold">{r.note}</Td>
                <Td className="font-mono text-sm">
                  {r.utr ?? <span className="text-ink-mute">—</span>}
                  {r.utrUsedBy && <span className="block font-sans text-xs font-bold text-danger">⚠️ already used for {r.utrUsedBy}</span>}
                </Td>
                <Td className="whitespace-nowrap text-sm">
                  {STATUS[r.status] ?? r.status}
                  {r.status === 'APPROVED' && r.credited !== r.amount && <span className="block text-xs">added {formatINR(r.credited ?? 0)}</span>}
                  {r.reviewNote && <span className="block text-xs text-ink-mute">{r.reviewNote}</span>}
                </Td>
                <Td>
                  {(r.status === 'PENDING' || r.status === 'STARTED') && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="lime" onClick={() => (setApproving(r), setAmount(String(r.amount)))}>Add coins</Button>
                      <Button size="sm" variant="white" onClick={() => setRejecting(r)}>Reject</Button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}

      <Modal
        open={!!approving}
        onClose={() => setApproving(null)}
        title={`Add coins for ${approving?.user.name ?? 'member'}`}
        footer={
          <Button
            variant="lime"
            loading={busy}
            disabled={!(Number(amount) >= 1)}
            onClick={() => approving && act(() => api.admin.approveTopup(approving.id, { amount: Number(amount), note: note || undefined }), `${amount} coins added`)}
          >
            I’ve seen the payment — add {Number(amount) || 0} coins
          </Button>
        }
      >
        {approving && (
          <div className="space-y-3 text-sm">
            <p>
              Look for <b>{formatINR(approving.amount)}</b> with the note <b className="font-mono">{approving.note}</b>
              {approving.utr && (
                <>
                  {' '}and transaction ID <b className="font-mono">{approving.utr}</b>
                </>
              )}
              .
            </p>
            {approving.utrUsedBy && <p className="font-bold text-danger">⚠️ This transaction ID was already approved for {approving.utrUsedBy}.</p>}
            <Field label="Coins to add (the amount you actually received)">
              <Input type="number" min={1} max={10000} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Note (optional, kept in the audit log)">
              <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this top-up?"
        footer={
          <Button variant="danger" loading={busy} disabled={note.trim().length < 3} onClick={() => rejecting && act(() => api.admin.rejectTopup(rejecting.id, note), 'Rejected')}>
            Reject
          </Button>
        }
      >
        <Field label="Reason (the member sees this)">
          <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="We couldn’t find a payment with this note." />
        </Field>
      </Modal>
    </>
  );
}
