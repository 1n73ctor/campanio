'use client';

import Link from 'next/link';
import { Card, Stat, StatusBadge } from '@companio/ui';
import { BarChart } from '@/admin/components/bar-chart';
import { ErrorBox, Loading, PageTitle } from '@/admin/components/ui';
import { useAdmin, useLoad } from '@/admin/lib/api';
import { BOOKING_STATUS_LABEL, formatINR } from '@/admin/lib/format';

export default function Dashboard() {
  const { api } = useAdmin();
  const { data, error } = useLoad(() => api.admin.stats(), []);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const queues = [
    { href: '/sos', label: 'Active SOS', n: data.activeSos, tone: 'pink' as const },
    { href: '/kyc', label: 'KYC to review', n: data.pendingKyc, tone: 'sunny' as const },
    { href: '/disputes', label: 'Open disputes', n: data.openDisputes, tone: 'tangerine' as const },
    { href: '/moderation', label: 'Open reports', n: data.openReports, tone: 'lavender' as const },
    { href: '/payouts', label: 'Payouts pending', n: data.pendingPayouts, tone: 'sky' as const },
  ];

  return (
    <>
      <PageTitle title="Dashboard" subtitle="Platform health at a glance. Money is in INR." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="GMV (net of refunds)" value={formatINR(data.gmv)} tone="lime" />
        <Stat label="Platform revenue" value={formatINR(data.revenue)} tone="pink" hint="Fees + GST + commission" />
        <Stat label="In escrow now" value={formatINR(data.inEscrow)} tone="sky" />
        <Stat label="Members / companions" value={`${data.users} / ${data.companions}`} tone="sunny" hint={`${data.listedCompanions} live companions`} />
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-extrabold">Work queues</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {queues.map((q) => (
          <Link key={q.href} href={q.href}>
            <Card interactive tone={q.n ? q.tone : 'white'} className="p-4">
              <p className="font-display text-3xl font-extrabold tabular-nums">{q.n}</p>
              <p className="text-sm font-semibold">{q.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <BarChart title="Paid bookings per day · last 14 days" color="#7B5CF0" data={data.series.map((s) => ({ label: day(s.date), value: s.bookings }))} />
        <BarChart title="GMV per day · last 14 days" color="#E4449C" format={formatINR} data={data.series.map((s) => ({ label: day(s.date), value: s.gmv }))} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-3 font-display text-lg font-extrabold">Bookings by status</h2>
          <ul className="divide-y-2 divide-ink/10">
            {Object.entries(data.bookings)
              .sort((a, b) => b[1] - a[1])
              .map(([status, n]) => (
                <li key={status} className="flex items-center justify-between py-2">
                  <Link href={`/admin/bookings?status=${status}`}>
                    <StatusBadge status={status} label={BOOKING_STATUS_LABEL[status]} />
                  </Link>
                  <span className="font-display font-extrabold tabular-nums">{n}</span>
                </li>
              ))}
          </ul>
        </Card>
        <BarChart title="New sign-ups per day · last 14 days" color="#7B5CF0" data={data.series.map((s) => ({ label: day(s.date), value: s.signups }))} />
      </div>
    </>
  );
}
