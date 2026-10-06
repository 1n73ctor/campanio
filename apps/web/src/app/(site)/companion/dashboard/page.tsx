'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatINR, type CompanionDashboardDto } from '@companio/types';
import { Button, Callout, Card, EmptyState, Stat, StatusBadge, Toggle, buttonClass } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { FullLoader, PageHeader } from '@/components/misc';
import { BookingRow } from '@/components/booking-row';
import { useToast } from '@/components/toast';
import { errMsg } from '@/lib/format';

export default function CompanionDashboard() {
  const user = useRequireAuth({ companion: true });
  const { api } = useAuth();
  const toast = useToast();
  const [d, setD] = useState<CompanionDashboardDto | null>(null);
  const load = useCallback(() => api.companion.dashboard().then(setD).catch((e) => toast(errMsg(e), 'error')), [api, toast]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);
  useRealtime({ 'booking:update': () => load() });

  if (!user || !d) return <FullLoader />;
  const kyc = d.profile.kycStatus;

  return (
    <div className="container-x pb-10">
      <PageHeader
        eyebrow="Companion"
        title={`Hey ${user.name?.split(' ')[0]} 👋`}
        actions={
          <>
            <Link href="/companion/profile" className={buttonClass('white', 'sm')}>
              Edit profile
            </Link>
            {d.profile.isListed && (
              <Link href={`/companions/${d.profile.id}`} className={buttonClass('white', 'sm')}>
                View public page
              </Link>
            )}
          </>
        }
      />

      {kyc !== 'APPROVED' && (
        <Callout tone={kyc === 'REJECTED' ? 'pink' : 'sunny'} title={kyc === 'PENDING' ? 'Verification under review ⏳' : kyc === 'REJECTED' ? 'Verification needs attention' : 'Verify your ID to go live'} className="mb-6">
          {kyc === 'PENDING' ? 'We usually review within 24 hours. You’ll get a notification.' : kyc === 'REJECTED' ? d.latestKyc?.reviewNote ?? 'Please re-submit.' : 'Members can only book verified hosts.'}{' '}
          {kyc !== 'PENDING' && (
            <Link href="/companion/kyc" className="font-bold underline">
              Verify now →
            </Link>
          )}
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Wallet" value={formatINR(d.walletBalance)} tone="lime" hint={<Link href="/wallet" className="underline">Withdraw →</Link>} />
        <Stat label="In escrow" value={formatINR(d.inEscrow)} tone="sky" hint="Released after sessions" />
        <Stat label="This month" value={formatINR(d.thisMonthEarnings)} tone="pink" />
        <Stat label="Lifetime" value={formatINR(d.lifetimeEarnings)} tone="sunny" hint={`★ ${d.profile.ratingAvg || '–'} · ${d.profile.completedBookings} meetups`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-display text-xl font-extrabold">Requests {d.pendingRequests.length > 0 && <span className="text-pink-deep">({d.pendingRequests.length})</span>}</h2>
            {d.pendingRequests.length === 0 ? <EmptyState emoji="📭" title="No pending requests" body="Keep your availability fresh to get more meetups." /> : <div className="space-y-3">{d.pendingRequests.map((b) => <BookingRow key={b.id} b={b} />)}</div>}
          </section>
          <section>
            <h2 className="mb-3 font-display text-xl font-extrabold">Upcoming</h2>
            {d.upcoming.length === 0 ? <p className="text-sm text-ink-soft">Nothing confirmed yet.</p> : <div className="space-y-3">{d.upcoming.map((b) => <BookingRow key={b.id} b={b} />)}</div>}
          </section>
        </div>
        <aside className="space-y-4">
          <Card className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="font-display font-extrabold">{d.profile.isListed ? 'You’re live 🟢' : 'Profile paused'}</p>
              <p className="text-xs text-ink-soft">{d.profile.isListed ? 'Members can find you and send meetup requests.' : 'Hidden from search.'}</p>
            </div>
            <Toggle
              checked={d.profile.isListed}
              disabled={kyc !== 'APPROVED'}
              label="Listed"
              onChange={async (v) => {
                try {
                  await api.companion.setListed(v);
                  load();
                } catch (e) {
                  toast(errMsg(e), 'error');
                }
              }}
            />
          </Card>
          {user.gender === 'FEMALE' && (
            <Card className="space-y-2 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display font-extrabold">👩 Women-only meetups</p>
                  <p className="text-xs text-ink-soft">{d.profile.womenOnly ? 'Only women members can send you requests.' : 'Anyone can send you requests.'}</p>
                </div>
                <Toggle
                  checked={d.profile.womenOnly}
                  label="Only accept meetups from women"
                  onChange={async (v) => {
                    try {
                      await api.companion.updateProfile({ womenOnly: v });
                      toast(v ? 'Only women can send you requests now' : 'Anyone can send you requests now');
                      load();
                    } catch (e) {
                      toast(errMsg(e), 'error');
                    }
                  }}
                />
              </div>
              <p className="text-xs text-ink-mute">
                Members choose their gender at sign-up and can’t change it later. If someone misrepresents themselves, report them and our team will act. Existing
                bookings aren’t affected.
              </p>
            </Card>
          )}
          <Card className="p-5">
            <h3 className="mb-2 font-display font-extrabold">Recent payouts</h3>
            {d.payouts.length === 0 ? (
              <p className="text-sm text-ink-soft">No payouts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {d.payouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span>{formatINR(p.amount)}</span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
            <Link href="/wallet" className="mt-3 block">
              <Button variant="white" size="sm" className="w-full">
                Open wallet
              </Button>
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
