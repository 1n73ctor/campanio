'use client';

import { useEffect, useState } from 'react';
import type { BookingDto, SafetyShareDto } from '@companio/types';
import { Button } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { useToast } from './toast';

const SHAREABLE = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'];

/** "Watch my session": a private link for someone you trust (live status, your location, a safety-alert button). */
export function TrustedContact({ booking }: { booking: BookingDto }) {
  const { api } = useAuth();
  const toast = useToast();
  const [share, setShare] = useState<SafetyShareDto | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const other = (booking.viewerRole === 'companion' ? booking.user.name : booking.companion.name)?.split(' ')[0] ?? 'them';

  useEffect(() => {
    api.bookings.safetyShare(booking.id).then(setShare).catch(() => setShare(null));
  }, [api, booking.id]);

  if (!SHAREABLE.includes(booking.status) || share === undefined) return null;

  const message = (url: string) =>
    `I'm meeting ${other} through Companio (${new Date(booking.startAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} at ${booking.meetingPoint}). You can follow the session and my live location here: ${url}`;

  const start = async () => {
    setBusy(true);
    try {
      setShare(await api.bookings.createSafetyShare(booking.id));
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    setBusy(true);
    try {
      await api.bookings.stopSafetyShare(booking.id);
      setShare(null);
      toast('Link turned off — it no longer works');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-chunky border-2 border-ink bg-white p-3">
      <p className="font-bold">👀 Trusted contact</p>
      {!share ? (
        <>
          <p className="text-xs text-ink-soft">
            Send a private link to a friend or family member. They’ll see who you’re meeting, where and when, the session status and your live location (if you share
            it), and can alert our safety team. No phone numbers are shown.
          </p>
          <Button size="sm" variant="white" className="w-full" loading={busy} onClick={start}>
            Share with a trusted contact
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-ink-soft">Your private link is on. It stops working a few hours after the session ends, or when you turn it off.</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message(share.url))}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-full border-2 border-ink bg-mint px-3 py-1.5 text-center text-sm font-bold"
            >
              Send on WhatsApp
            </a>
            <button
              type="button"
              className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold"
              onClick={() =>
                navigator.clipboard
                  .writeText(share.url)
                  .then(() => toast('Link copied'))
                  .catch(() => toast('Couldn’t copy — long-press the link instead', 'error'))
              }
            >
              Copy link
            </button>
          </div>
          <button type="button" className="text-xs font-semibold underline" disabled={busy} onClick={stop}>
            Turn off link
          </button>
        </>
      )}
    </div>
  );
}
