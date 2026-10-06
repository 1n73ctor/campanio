'use client';

import { useEffect, useState } from 'react';
import { formatINR, type ReferralDto } from '@companio/types';
import { Button, Card, cn } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { SITE_URL } from '@/lib/env';
import { useToast } from './toast';

/** Invite-a-friend: share link + stats. Both people get the reward after the friend's first completed booking. */
export function InviteCard({ className }: { className?: string }) {
  const { api } = useAuth();
  const toast = useToast();
  const [r, setR] = useState<ReferralDto | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    api.referrals.me().then(setR).catch(() => {});
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, [api]);

  if (!r) return null;
  const link = `${SITE_URL}/?ref=${r.code}`;
  const message = `Join me on Companio — find verified buddies for the gym, movies, city walks and more. Sign up with my link and we both get ${formatINR(r.reward)} after your first meetup: ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied ✓');
    } catch {
      toast('Couldn’t copy — long-press the link to copy it', 'error');
    }
  };

  return (
    <Card tone="lavender" className={cn('p-6', className)}>
      <p className="font-display text-xl font-extrabold">🎁 Invite friends, get {formatINR(r.reward)} each</p>
      <p className="mt-1 text-sm text-ink-soft">
        When a friend signs up with your link and completes their first booking, you both get {formatINR(r.reward)} credit for your next booking.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <code className="flex h-11 min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-chunky border-3 border-ink bg-white px-3.5 text-sm">{link}</code>
        <Button variant="dark" onClick={copy}>
          Copy link
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="rounded-full border-3 border-ink bg-mint px-4 py-1.5 text-sm font-bold">
          Share on WhatsApp
        </a>
        {canShare && (
          <button type="button" onClick={() => navigator.share({ title: 'Join me on Companio', text: message }).catch(() => {})} className="rounded-full border-3 border-ink bg-white px-4 py-1.5 text-sm font-bold">
            More options…
          </button>
        )}
        <span className="self-center text-sm text-ink-soft">
          or share code <b className="font-mono tracking-wider text-ink">{r.code}</b>
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ['Signed up', r.invited],
          ['Completed', r.rewarded],
          ['You earned', formatINR(r.earned)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-chunky border-2 border-ink bg-white px-2 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">{label}</dt>
            <dd className="font-display text-lg font-extrabold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
