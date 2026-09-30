'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { BOOKING_STATUS_LABEL, CATEGORIES, formatINR, type BookingDto } from '@companio/types';
import { Avatar, Badge, Button, Callout, Card, Field, Input, Modal, StatusBadge, Textarea, buttonClass, cn } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { FullLoader } from '@/components/misc';
import { Chat } from '@/components/chat';
import { SafetyPanel } from '@/components/safety-panel';
import { ReportDialog } from '@/components/report-dialog';
import { useToast } from '@/components/toast';
import { errMsg, fmtDateTime } from '@/lib/format';

const STEPS = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] as const;

export default function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useRequireAuth();
  const { api } = useAuth();
  const toast = useToast();
  const [b, setB] = useState<BookingDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'cancel' | 'decline' | 'start' | 'dispute' | 'review' | 'report'>(null);
  const [text, setText] = useState('');
  const [text2, setText2] = useState('');
  const [rating, setRating] = useState(5);

  const load = useCallback(() => api.bookings.get(id).then(setB).catch((e) => setErr(errMsg(e))), [api, id]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);
  useRealtime({ 'booking:update': (u: BookingDto) => u.id === id && load() });

  if (err) return <div className="container-x py-16 text-center font-semibold">{err}</div>;
  if (!user || !b) return <FullLoader />;

  const isUser = b.viewerRole === 'user';
  const other = isUser ? b.companion : b.user;
  const cat = CATEGORIES.find((c) => c.slug === b.category);
  const stepIdx = STEPS.indexOf(b.status as (typeof STEPS)[number]);

  const act = async (name: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(name);
    try {
      const r = await fn();
      toast((r as { summary?: string })?.summary ?? ok);
      setModal(null);
      setText('');
      setText2('');
      await load();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const closeModal = () => {
    setModal(null);
    setText('');
    setText2('');
  };

  return (
    <div className="container-x max-w-6xl py-8">
      <Link href="/bookings" className="text-sm font-semibold underline">
        ← All bookings
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar name={other.name} src={other.avatarUrl} size={64} />
                <div>
                  <h1 className="text-2xl font-extrabold">
                    {cat?.emoji} {cat?.name} with {other.name?.split(' ')[0]}
                  </h1>
                  <p className="text-ink-soft">
                    {fmtDateTime(b.startAt)} · {b.hours}h
                  </p>
                  <p className="text-ink-soft">📍 {b.meetingPoint}</p>
                </div>
              </div>
              <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
            </div>

            {stepIdx >= 0 && (
              <ol className="mt-6 grid grid-cols-4 gap-2 text-center text-xs font-bold">
                {STEPS.map((s, i) => (
                  <li key={s} className={cn('rounded-chunky border-2 border-ink py-2', i <= stepIdx ? 'bg-lime' : 'bg-paper-deep text-ink-mute')}>
                    {BOOKING_STATUS_LABEL[s]}
                  </li>
                ))}
              </ol>
            )}

            {b.note && <p className="mt-5 rounded-chunky bg-paper p-3 text-sm">💬 “{b.note}”</p>}

            {/* role-specific guidance + actions */}
            <div className="mt-6 space-y-3">
              {isUser && b.status === 'REQUESTED' && <Callout tone="sunny" title="Waiting for confirmation">{other.name?.split(' ')[0]} usually replies within a few hours. If they don’t, you’re refunded automatically.</Callout>}
              {isUser && (b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS') && b.startCode && b.status === 'ACCEPTED' && (
                <Card tone="lime" className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-display font-extrabold">Your start code</p>
                    <p className="text-sm">Share it in person when you meet — that’s what starts the session.</p>
                  </div>
                  <span className="rounded-chunky border-3 border-ink bg-white px-4 py-2 font-display text-3xl font-extrabold tracking-[0.3em]">{b.startCode}</span>
                </Card>
              )}
              {!isUser && b.status === 'REQUESTED' && <Callout tone="sunny" title="New request">You’ll earn {formatINR(b.companionPayout)} for this booking. Accept to lock the slot.</Callout>}
              {!isUser && b.status === 'ACCEPTED' && <Callout tone="sky" title="At the meetup">Ask {other.name?.split(' ')[0]} for their 4-digit start code to begin the session.</Callout>}
              {b.status === 'COMPLETED' && b.escrow?.status === 'HELD' && isUser && <Callout tone="mint" title="How did it go?">Confirm to release payment now. Something wrong? Raise an issue — payment stays on hold until we review.</Callout>}
              {b.status === 'DISPUTED' && <Callout tone="pink" title="Under review">Our team is reviewing “{b.dispute?.reason}”. Payment is frozen until it’s resolved — we’ll notify you both.</Callout>}
              {b.cancelReason && ['CANCELLED', 'DECLINED', 'EXPIRED'].includes(b.status) && <Callout tone="white" title={BOOKING_STATUS_LABEL[b.status]}>{b.cancelReason}</Callout>}

              <div className="flex flex-wrap gap-2">
                {!isUser && b.status === 'REQUESTED' && (
                  <>
                    <Button variant="lime" loading={busy === 'accept'} onClick={() => act('accept', () => api.bookings.accept(b.id), 'Booking accepted ✅')}>
                      Accept
                    </Button>
                    <Button variant="white" onClick={() => setModal('decline')}>
                      Decline
                    </Button>
                  </>
                )}
                {!isUser && b.status === 'ACCEPTED' && <Button variant="lime" onClick={() => setModal('start')}>Enter start code</Button>}
                {b.status === 'IN_PROGRESS' && (
                  <Button variant="lime" loading={busy === 'complete'} onClick={() => act('complete', () => api.bookings.complete(b.id), isUser ? 'Thanks! Payment released 💸' : 'Marked complete')}>
                    {isUser ? 'End & confirm session' : 'Mark complete'}
                  </Button>
                )}
                {isUser && b.status === 'COMPLETED' && b.escrow?.status === 'HELD' && (
                  <Button variant="lime" loading={busy === 'complete'} onClick={() => act('complete', () => api.bookings.complete(b.id), 'Thanks! Payment released 💸')}>
                    All good — release payment
                  </Button>
                )}
                {isUser && b.status === 'COMPLETED' && !b.hasReview && <Button variant="sunny" onClick={() => setModal('review')}>⭐ Leave a review</Button>}
                {isUser && b.status === 'PENDING_PAYMENT' && (
                  <Link href={`/checkout/${b.id}`} className={buttonClass('primary')}>
                    Complete payment
                  </Link>
                )}
                {['PENDING_PAYMENT', 'REQUESTED', 'ACCEPTED'].includes(b.status) && (isUser || b.status === 'ACCEPTED') && (
                  <Button variant="white" onClick={() => setModal('cancel')}>
                    Cancel booking
                  </Button>
                )}
                {['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) && !b.dispute && b.escrow?.status === 'HELD' && (
                  <Button variant="ghost" onClick={() => setModal('dispute')}>
                    Report a problem
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setModal('report')}>
                  🚩 Report {other.name?.split(' ')[0]}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b-3 border-ink bg-lavender-soft px-5 py-3">
              <h2 className="font-display text-lg font-extrabold">Chat with {other.name?.split(' ')[0]}</h2>
              <Badge tone="white">🛡️ contact info hidden</Badge>
            </div>
            <Chat booking={b} />
          </Card>
        </div>

        <aside className="space-y-4">
          <SafetyPanel booking={b} />
          <Card className="space-y-2 p-5 text-sm">
            <h2 className="mb-2 font-display text-lg font-extrabold">Payment</h2>
            {isUser ? (
              <>
                <Row l={`${formatINR(b.hourlyRate)} × ${b.hours}h`} r={formatINR(b.subtotal)} />
                <Row l="Connection fee + GST" r={formatINR(b.connectionFee + b.gst)} />
                <Row l="Total paid" r={formatINR(b.total)} bold />
              </>
            ) : (
              <>
                <Row l="Booking value" r={formatINR(b.subtotal)} />
                <Row l="Platform commission" r={`− ${formatINR(b.commission)}`} />
                <Row l="Your earnings" r={formatINR(b.companionPayout)} bold />
              </>
            )}
            {b.escrow && (
              <div className="!mt-3 flex items-center justify-between border-t-2 border-dashed border-ink/20 pt-3">
                <span>Escrow</span>
                <StatusBadge status={b.escrow.status} />
              </div>
            )}
            {b.escrow && b.escrow.refunded > 0 && <Row l="Refunded to wallet" r={formatINR(b.escrow.refunded)} />}
            {b.escrow && b.escrow.released > 0 && <Row l="Released to companion" r={formatINR(b.escrow.released)} />}
          </Card>
          <p className="px-2 text-xs text-ink-mute">Booking ID {b.id}</p>
        </aside>
      </div>

      {/* modals */}
      <Modal
        open={modal === 'cancel'}
        onClose={closeModal}
        title="Cancel booking?"
        footer={
          <Button variant="danger" loading={busy === 'cancel'} onClick={() => act('cancel', () => api.bookings.cancel(b.id, text || undefined), 'Booking cancelled')}>
            Yes, cancel
          </Button>
        }
      >
        <p className="text-sm text-ink-soft">
          {isUser
            ? b.status === 'ACCEPTED'
              ? 'Cancelling 24h+ before start refunds the companion’s fee (the connection fee and GST are non-refundable after acceptance). Later cancellations refund 50% of the companion’s fee.'
              : 'You’ll get a full refund to your wallet.'
            : 'The member gets a full 100% refund, including GST. Cancellations after accepting affect your standing.'}
        </p>
        <Field label="Reason (optional)">
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
        </Field>
      </Modal>
      <Modal open={modal === 'decline'} onClose={closeModal} title="Decline request" footer={<Button variant="danger" loading={busy === 'decline'} onClick={() => act('decline', () => api.bookings.decline(b.id, text || undefined), 'Declined — member refunded')}>Decline</Button>}>
        <Field label="Reason (shared with the member)">
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Sorry, I’m not free then" />
        </Field>
      </Modal>
      <Modal open={modal === 'start'} onClose={closeModal} title="Start the session" footer={<Button variant="lime" loading={busy === 'start'} disabled={text.length !== 4} onClick={() => act('start', () => api.bookings.start(b.id, text), 'Session started — have fun!')}>Start</Button>}>
        <Field label={`${other.name?.split(' ')[0]}’s 4-digit code`}>
          <Input inputMode="numeric" className="text-center font-display text-3xl tracking-[0.5em]" value={text} onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus />
        </Field>
      </Modal>
      <Modal open={modal === 'dispute'} onClose={closeModal} title="Report a problem" footer={<Button variant="danger" loading={busy === 'dispute'} disabled={text.trim().length < 3} onClick={() => act('dispute', () => api.bookings.dispute(b.id, text.trim(), text2 || undefined), 'Submitted — payment is on hold')}>Submit</Button>}>
        <p className="text-sm text-ink-soft">Payment will be frozen while our team reviews. We aim to resolve within 48 hours.</p>
        <Field label="What went wrong?">
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="e.g. Arrived very late / didn’t show" />
        </Field>
        <Field label="Details">
          <Textarea value={text2} onChange={(e) => setText2(e.target.value)} maxLength={1500} />
        </Field>
      </Modal>
      <Modal open={modal === 'review'} onClose={closeModal} title={`Rate ${other.name?.split(' ')[0]}`} footer={<Button loading={busy === 'review'} onClick={() => act('review', () => api.bookings.review(b.id, rating, text || undefined), 'Thanks for the review! ⭐')}>Post review</Button>}>
        <div className="flex justify-center gap-2 text-4xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className={n <= rating ? 'text-sunny-deep' : 'text-ink/20'}>
              ★
            </button>
          ))}
        </div>
        <Field label="Comment (optional)">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={800} placeholder="What made it great?" />
        </Field>
      </Modal>
      <ReportDialog open={modal === 'report'} onClose={closeModal} targetUserId={other.id} bookingId={b.id} name={other.name} />
    </div>
  );
}

const Row = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
  <div className={cn('flex justify-between', bold && 'font-display text-base font-extrabold')}>
    <span>{l}</span>
    <span className="tabular-nums">{r}</span>
  </div>
);
