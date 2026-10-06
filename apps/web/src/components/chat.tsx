'use client';

import { useEffect, useRef, useState } from 'react';
import type { BookingDto, MessageDto } from '@companio/types';
import { Button, Input, cn } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { errMsg, fmtTime } from '@/lib/format';
import { ReportDialog } from './report-dialog';
import { useToast } from './toast';

const OPEN = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'];

export function Chat({ booking }: { booking: BookingDto }) {
  const { api, user } = useAuth();
  const toast = useToast();
  const [msgs, setMsgs] = useState<MessageDto[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [reportMsg, setReportMsg] = useState<MessageDto | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const other = booking.viewerRole === 'companion' ? booking.user : booking.companion;

  useEffect(() => {
    api.bookings.messages(booking.id).then(setMsgs).catch(() => {});
  }, [api, booking.id]);

  useRealtime(
    {
      'message:new': (m: MessageDto) => m.bookingId === booking.id && setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m])),
      'chat:typing': (d: { bookingId: string; userId: string }) => {
        if (d.bookingId !== booking.id || d.userId === user?.id) return;
        setTyping(true);
        setTimeout(() => setTyping(false), 2500);
      },
    },
    booking.id,
  );

  // block body: newer Chrome returns a Promise from smooth scrollIntoView, which React would treat as a cleanup
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const r = await api.bookings.send(booking.id, body);
      setMsgs((x) => (x.some((y) => y.id === r.message.id) ? x : [...x, r.message]));
      setText('');
      if (r.warning) toast(r.warning, 'info');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const canSend = OPEN.includes(booking.status);
  return (
    <div className="flex h-[480px] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-ink-mute">Say hi 👋 Plan the details here — contact info is hidden for your safety.</p>}
        {msgs.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={cn('group flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl border-2 border-ink px-3.5 py-2 text-[15px]', mine ? 'rounded-br-sm bg-pink-soft' : 'rounded-bl-sm bg-white', m.hidden && 'italic text-ink-mute')}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-mute">
                  {fmtTime(m.createdAt)}
                  {m.flagged && !m.hidden && <span title="Contact details were hidden">🛡️</span>}
                  {!mine && !m.hidden && (
                    <button className="hidden underline group-hover:inline" onClick={() => setReportMsg(m)}>
                      report
                    </button>
                  )}
                </p>
              </div>
            </div>
          );
        })}
        {typing && <p className="text-xs text-ink-mute">{other.name?.split(' ')[0]} is typing…</p>}
        <div ref={endRef} />
      </div>
      {canSend ? (
        <form
          className="flex gap-2 border-t-3 border-ink p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" maxLength={1000} aria-label="Message" />
          <Button type="submit" loading={busy} disabled={!text.trim()}>
            Send
          </Button>
        </form>
      ) : (
        <p className="border-t-3 border-ink p-3 text-center text-sm text-ink-mute">Chat is closed for this meetup.</p>
      )}
      {reportMsg && <ReportDialog open onClose={() => setReportMsg(null)} targetUserId={other.id} bookingId={booking.id} messageId={reportMsg.id} name={other.name} />}
    </div>
  );
}
