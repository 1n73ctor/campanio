'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatINR, type CompanionFeeDto } from '@companio/types';
import { Button } from '@companio/ui';
import { useAuth } from '@/lib/auth';

const KEY = 'companio.hostPromo';
const AFTER_MS = 40_000;
const NOT_INTERESTED_DAYS = 10;
const QUIET = ['/login', '/onboarding', '/checkout', '/become-a-companion', '/companion', '/view-as', '/wallet', '/account'];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

type Seen = { day?: string; session?: string; until?: number; pages?: number };
const read = (): Seen => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Seen;
  } catch {
    return {};
  }
};
const write = (s: Seen) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
};

/**
 * "Become a host" invitation for signed-in members who aren't hosts yet, after they've looked around (40 seconds or a
 * second page). Closing it hides it for the rest of the day and this sign-in; "Not interested" hides it for 10 days.
 */
export function HostPromo() {
  const { api, user, token, viewAs } = useAuth();
  const path = usePathname() ?? '/';
  const [show, setShow] = useState(false);
  const [fee, setFee] = useState<CompanionFeeDto | null>(null);
  const session = token ? token.slice(-16) : '';
  const eligible = !!user && user.onboarded && !user.companion && user.role !== 'ADMIN' && !viewAs;
  const quiet = QUIET.some((p) => path.startsWith(p));

  // count pages looked at in this session
  useEffect(() => {
    if (!eligible) return;
    const s = read();
    // a new sign-in starts over (but "Not interested" still holds)
    write(s.session === session ? { ...s, pages: (s.pages ?? 0) + 1 } : { until: s.until, session, pages: 1 });
  }, [eligible, path, session]);

  useEffect(() => {
    if (!eligible || quiet || show) return;
    const s = read();
    if (s.until && Date.now() < s.until) return;
    if (s.day === today() && s.session === session) return; // closed today in this sign-in
    const open = () => {
      if (document.querySelector('[role=dialog]')) return; // never on top of the chat or another window
      setShow(true);
      api.companion.fee().then(setFee).catch(() => {});
    };
    if ((s.pages ?? 0) >= 2) {
      const t = setTimeout(open, 8_000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(open, AFTER_MS);
    return () => clearTimeout(t);
  }, [eligible, quiet, path, show, session, api]);

  if (!show || !user) return null;
  const close = (notInterested = false) => {
    write({ ...read(), day: today(), session, ...(notInterested ? { until: Date.now() + NOT_INTERESTED_DAYS * 86_400_000 } : {}) });
    setShow(false);
  };
  const woman = user.gender === 'FEMALE';
  const first = user.name?.split(' ')[0];

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-ink/40 p-3 sm:items-center" role="dialog" aria-label="Become a host" onClick={() => close()}>
      <div className="w-full max-w-md rounded-blob border-3 border-ink bg-paper p-6 shadow-brutal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-4xl" aria-hidden>
            {woman ? '💁‍♀️' : '🙋'}
          </p>
          <button type="button" onClick={() => close()} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white font-bold">
            ✕
          </button>
        </div>
        <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight">
          {woman ? `${first ? `${first}, h` : 'H'}ost coffee chats & city walks — on your terms` : `${first ? `${first}, l` : 'L'}ike showing people around? Become a host`}
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li>💸 Set your own rate and the hours you’re free</li>
          <li>{woman ? '👭 Choose women-only meetups if you prefer' : '☕ Coffee, gym, food walks, city tours — your pick'}</li>
          <li>🛡️ Public places only · ID-verified members · SOS & live location</li>
          <li>🙅 Accept only the requests you like — decline anyone</li>
        </ul>
        {fee && (
          <p className="mt-3 rounded-chunky border-2 border-ink bg-lime-soft px-3 py-2 text-sm font-semibold">
            {fee.paid ? 'Your registration is already paid — just finish your profile.' : fee.due ? `One-time registration ${formatINR(fee.total)} (incl. GST), then it’s yours.` : 'Free to join — no registration fee.'}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href="/become-a-companion" onClick={() => close()}>
            <Button>Become a host →</Button>
          </Link>
          <Button variant="white" onClick={() => close()}>
            Maybe later
          </Button>
        </div>
        <button type="button" onClick={() => close(true)} className="mt-3 text-xs font-semibold text-ink-soft underline">
          Not interested
        </button>
      </div>
    </div>
  );
}
