'use client';

import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import type { ChatPricesDto, ConversationDto, DirectMessageDto } from '@companio/types';
import { Avatar, Button, Callout, Card, Input, cn } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { FullLoader } from '@/components/misc';
import { UnlockChat } from '@/components/message-host';
import { useToast } from '@/components/toast';
import { errMsg, fmtDateTime, fmtTime } from '@/lib/format';

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useRequireAuth();
  const { api, viewAs } = useAuth();
  const toast = useToast();
  const [conv, setConv] = useState<ConversationDto | null>(null);
  const [msgs, setMsgs] = useState<DirectMessageDto[]>([]);
  const [prices, setPrices] = useState<ChatPricesDto | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = () =>
    api.chats
      .get(id)
      .then((r) => (setConv(r.conversation), setMsgs(r.messages)))
      .catch((e) => setError(errMsg(e)));
  useEffect(() => {
    if (!user) return;
    load();
    api.chats.prices().then(setPrices).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);
  useRealtime({ 'dm:new': (m: DirectMessageDto) => m.conversationId === id && setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m])) });
  useEffect(() => {
    // braces matter: newer browsers return a Promise from scrollIntoView, and an effect may only return a clean-up function
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length]);

  if (error) return <div className="container-x max-w-xl py-16"><Callout tone="white" title="Chat not available">{error}</Callout></div>;
  if (!user || !conv) return <FullLoader />;
  const first = conv.other.name?.split(' ')[0] ?? 'them';
  const isHost = conv.viewerRole === 'host';

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const r = await api.chats.send(id, body);
      setMsgs((x) => (x.some((y) => y.id === r.message.id) ? x : [...x, r.message]));
      setText('');
      if (r.warning) toast(r.warning);
      if (isHost && !conv.hostReplied) setConv({ ...conv, hostReplied: true, refundDueAt: null });
    } catch (e) {
      toast(errMsg(e), 'error');
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x flex max-w-2xl flex-col pb-6 pt-6">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/messages" className="text-sm font-semibold underline">← Messages</Link>
      </div>
      <Card className="flex items-center gap-3 p-4">
        <Avatar name={conv.other.name} src={conv.other.avatarUrl} size={48} />
        <div className="min-w-0 flex-1">
          {conv.other.companionId ? (
            <Link href={`/companions/${conv.other.companionId}`} className="font-display text-lg font-extrabold underline">{conv.other.name}</Link>
          ) : (
            <p className="font-display text-lg font-extrabold">{conv.other.name}</p>
          )}
          <p className="text-xs text-ink-soft">
            {isHost
              ? conv.hostReplied
                ? 'Replies are free for hosts.'
                : `⏳ Reply${conv.refundDueAt ? ` before ${fmtDateTime(conv.refundDueAt)}` : ''} — otherwise ${first}’s coins are refunded.`
              : conv.permanent
                ? 'Open for good'
                : conv.canWrite
                  ? `Open until ${fmtDateTime(conv.accessUntil!)}`
                  : 'Chat time over'}
          </p>
        </div>
      </Card>

      {!isHost && !conv.hostReplied && conv.refundDueAt && (
        <p className="mt-3 rounded-chunky border-2 border-ink bg-sunny px-3 py-2 text-sm">
          ↩️ If {first} hasn’t replied by {fmtDateTime(conv.refundDueAt)}, your coins come back automatically.
        </p>
      )}

      <div className="mt-4 min-h-[40vh] space-y-2">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-ink-mute">{isHost ? 'No messages yet.' : `Say hi to ${first} 👋`}</p>}
        {msgs.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl border-2 border-ink px-3 py-2 text-sm', mine ? 'bg-pink' : 'bg-white')}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-0.5 text-right text-[10px] text-ink-mute">{fmtTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {conv.canWrite ? (
        <form
          className="sticky bottom-3 mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Message ${first}…`} disabled={!!viewAs} aria-label="Message" />
          <Button type="submit" loading={busy} disabled={!text.trim() || !!viewAs}>Send</Button>
        </form>
      ) : (
        <Card tone="sunny" className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span>Your chat time with {first} is over. Open it again to keep writing.</span>
          {prices?.enabled && conv.other.companionId && <Button size="sm" onClick={() => setUnlocking(true)}>Open chat again</Button>}
        </Card>
      )}
      {prices && conv.other.companionId && (
        <UnlockChat open={unlocking} onClose={() => setUnlocking(false)} companionId={conv.other.companionId} name={first} prices={prices} conversation={conv} onOpened={(c) => setConv(c)} />
      )}
    </div>
  );
}
