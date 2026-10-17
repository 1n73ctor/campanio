'use client';

import Link from 'next/link';
import { use } from 'react';
import { Card, CoinAmount, cn } from '@companio/ui';
import { ErrorBox, Loading, PageTitle } from '@/admin/components/ui';
import { useAdmin, useLoad } from '@/admin/lib/api';
import { dtIST } from '@/admin/lib/format';

/** A paid chat, read-only, for moderation and support: every message (flagged ones marked) and every coin payment. */
export default function AdminChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api } = useAdmin();
  const { data: c, error } = useLoad(() => api.admin.chatConversation(id), [id]);
  if (error) return <ErrorBox error={error} />;
  if (!c) return <Loading />;
  return (
    <>
      <Link href="/admin/chats" className="text-sm font-semibold underline">← Paid chats</Link>
      <PageTitle
        title={`${c.user.name ?? 'Member'} → ${c.host.name ?? 'Host'}`}
        subtitle={c.permanent ? 'Open for good' : c.accessUntil ? `Open until ${dtIST(c.accessUntil)}` : 'Not open'}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-2 p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-extrabold">Messages ({c.messages.length})</h2>
          {c.messages.length === 0 && <p className="text-sm text-ink-mute">No messages yet.</p>}
          {c.messages.map((m) => {
            const fromHost = m.senderId === c.host.id;
            return (
              <div key={m.id} className={cn('rounded-xl border-2 p-2 text-sm', m.flagged ? 'border-danger bg-pink-soft' : 'border-ink/20', fromHost && 'ml-8')}>
                <p className="text-xs text-ink-mute">
                  <b>{fromHost ? c.host.name : c.user.name}</b> · {dtIST(m.createdAt)}
                  {m.flagged && <b className="text-danger"> · flagged: {m.flagReason}</b>}
                  {m.hidden && ' · hidden'}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            );
          })}
        </Card>
        <Card className="p-5 text-sm">
          <h2 className="font-display text-lg font-extrabold">Coin payments</h2>
          <ul className="mt-2 space-y-2">
            {c.unlocks.map((u) => (
              <li key={u.id} className="border-b-2 border-dashed border-ink/10 pb-2">
                <b><CoinAmount n={u.price} className="align-middle" /></b> · {u.kind === 'PERMANENT' ? 'forever' : `${u.hours}h`} · {u.status === 'ANSWERED' ? `earned · host got ${u.hostEarning}` : u.status === 'REFUNDED' ? 'refunded' : 'waiting for reply'}
                <span className="block text-xs text-ink-mute">{dtIST(u.createdAt)}{u.refundedAt ? ` · refunded ${dtIST(u.refundedAt)}` : ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
