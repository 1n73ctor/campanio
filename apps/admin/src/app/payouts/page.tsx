'use client';

import { useState } from 'react';
import type { PayoutDto } from '@companio/types';
import { Button, Field, Input, Modal, StatusBadge, Tabs } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errMsg, useAdmin, useLoad } from '@/lib/api';
import { dt, formatINR } from '@/lib/format';

export default function PayoutsPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<'REQUESTED' | 'PAID' | 'REJECTED'>('REQUESTED');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad(() => api.admin.payouts({ status, page }), [status, page]);
  const [sel, setSel] = useState<{ p: PayoutDto; mode: 'paid' | 'reject' } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      sel.mode === 'paid' ? await api.admin.payoutPaid(sel.p.id, text) : await api.admin.payoutReject(sel.p.id, text);
      toast(sel.mode === 'paid' ? 'Marked paid' : 'Rejected — amount re-credited');
      setSel(null);
      setText('');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Payouts" subtitle="Send via UPI/IMPS from the payout account, then record the UTR here. Amounts are already debited from the companion’s wallet." actions={<Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: 'REQUESTED', label: 'Pending' }, { value: 'PAID', label: 'Paid' }, { value: 'REJECTED', label: 'Rejected' }]} />} />
      {error && <ErrorBox error={error} />}
      {!data ? (
        <Loading />
      ) : (
        <>
          <Table head={['Companion', 'Amount', 'UPI ID', 'Requested', 'Status', '']} empty={data.items.length === 0}>
            {data.items.map((p) => (
              <tr key={p.id}>
                <Td className="font-semibold">{p.userName}</Td>
                <Td className="font-display font-extrabold tabular-nums">{formatINR(p.amount)}</Td>
                <Td className="font-mono text-xs">{p.upiId}</Td>
                <Td className="text-xs">{dt(p.createdAt)}</Td>
                <Td>
                  <StatusBadge status={p.status} />
                  {p.reference && <p className="mt-1 font-mono text-xs">UTR {p.reference}</p>}
                  {p.note && <p className="mt-1 text-xs">{p.note}</p>}
                </Td>
                <Td>
                  {p.status === 'REQUESTED' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="lime" onClick={() => setSel({ p, mode: 'paid' })}>
                        Mark paid
                      </Button>
                      <Button size="sm" variant="white" onClick={() => setSel({ p, mode: 'reject' })}>
                        Reject
                      </Button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.mode === 'paid' ? `Record payment of ${formatINR(sel?.p.amount ?? 0)}` : 'Reject payout'} footer={<Button loading={busy} disabled={text.trim().length < (sel?.mode === 'paid' ? 4 : 3)} onClick={submit}>Confirm</Button>}>
        <Field label={sel?.mode === 'paid' ? 'UTR / transaction reference' : 'Reason (sent to companion)'}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={sel?.mode === 'paid' ? '4123 5567 8890' : 'UPI ID is invalid'} />
        </Field>
      </Modal>
    </>
  );
}
