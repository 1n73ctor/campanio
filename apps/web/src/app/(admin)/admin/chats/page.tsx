'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Select, Stat, StatusBadge } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/admin/components/ui';
import { useAdmin, useLoad } from '@/admin/lib/api';
import { dtIST, formatINR } from '@/admin/lib/format';

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Waiting for reply', ANSWERED: 'Earned', REFUNDED: 'Refunded' };

/** Every coin payment to open a chat, with revenue totals. */
export default function ChatsPage() {
  const { api } = useAdmin();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data: stats } = useLoad(() => api.admin.chatStats(), []);
  const { data, error } = useLoad(() => api.admin.chatUnlocks({ page, status: status || undefined }), [page, status]);

  return (
    <>
      <PageTitle title="Paid chats" subtitle="Coin payments to open chats with hosts. All coins are platform revenue unless refunded." />
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Earned" value={formatINR(stats.earned)} tone="lime" />
          <Stat label="Waiting for reply" value={formatINR(stats.pending)} tone="sunny" />
          <Stat label="Refunded" value={formatINR(stats.refunded)} />
          <Stat label="Unlocks" value={stats.unlocks} />
          <Stat label="Chats" value={stats.conversations} />
        </div>
      )}
      <div className="mt-6 flex items-center gap-3">
        <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="max-w-56" aria-label="Status">
          <option value="">All</option>
          <option value="ACTIVE">Waiting for reply</option>
          <option value="ANSWERED">Earned</option>
          <option value="REFUNDED">Refunded</option>
        </Select>
      </div>
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <Table head={['When (IST)', 'Member', 'Host', 'Type', 'Coins', 'Status', '']} empty={data.items.length === 0}>
            {data.items.map((u) => (
              <tr key={u.id}>
                <Td className="whitespace-nowrap text-xs">{dtIST(u.createdAt)}</Td>
                <Td><Link href={`/admin/users/${u.user.id}`} className="underline">{u.user.name ?? '—'}</Link></Td>
                <Td><Link href={`/admin/users/${u.host.id}`} className="underline">{u.host.name ?? '—'}</Link></Td>
                <Td>{u.kind === 'PERMANENT' ? 'Forever' : `${u.hours}h`}</Td>
                <Td className="tabular-nums">
                  🪙 {u.price}
                  {u.promoUsed > 0 && <span className="block text-xs text-ink-mute">{formatINR(u.promoUsed)} from credit</span>}
                </Td>
                <Td>
                  <StatusBadge status={u.status === 'ANSWERED' ? 'COMPLETED' : u.status === 'REFUNDED' ? 'REFUNDED' : 'PENDING'} />
                  <span className="block text-xs text-ink-mute">{STATUS_LABEL[u.status]}{u.status === 'ACTIVE' ? ` · refund ${dtIST(u.refundDueAt)}` : u.refundedAt ? ` · ${dtIST(u.refundedAt)}` : ''}</span>
                </Td>
                <Td><Link href={`/admin/chats/${u.conversationId}`} className="font-bold underline">View chat</Link></Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
    </>
  );
}
