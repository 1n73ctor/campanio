'use client';

import Link from 'next/link';
import { Card, Stat, StatusBadge } from '@companio/ui';
import { BarChart } from '@/admin/components/bar-chart';
import { ErrorBox, Loading, PageTitle } from '@/admin/components/ui';
import { MaintenanceSwitch } from '@/admin/components/maintenance';
import { useAdmin, useLoad } from '@/admin/lib/api';
import { BOOKING_STATUS_LABEL, formatINR } from '@/admin/lib/format';

export default function Dashboard() {
  const { api } = useAdmin();
  const { data, error } = useLoad(() => api.admin.stats(), []);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const queues = [
    { href: '/admin/sos', label: 'Active SOS', n: data.activeSos, tone: 'pink' as const },
    { href: '/admin/kyc', label: 'KYC to review', n: data.pendingKyc, tone: 'sunny' as const },
    { href: '/admin/disputes', label: 'Open disputes', n: data.openDisputes, tone: 'tangerine' as const },
    { href: '/admin/moderation', label: 'Open reports', n: data.openReports, tone: 'lavender' as const },
    { href: '/admin/payouts', label: 'Payouts pending', n: data.pendingPayouts, tone: 'sky' as const },
  ];

  return (
    <>
      <PageTitle title="Dashboard" subtitle="Platform health at a glance. Money is in INR." actions={<MaintenanceSwitch />} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/admin/users">
          <Stat label="Total users" value={data.users.toLocaleString('en-IN')} tone="lavender" hint={`+${data.series.slice(-7).reduce((n, d) => n + d.signups, 0)} joined in the last 7 days`} />
        </Link>
        <Link href="/admin/users">
          <Stat label="Members" value={(data.users - data.companions).toLocaleString('en-IN')} tone="mint" hint="Signed up, not hosts" />
        </Link>
        <Link href="/admin/users">
          <Stat label="Hosts" value={data.companions.toLocaleString('en-IN')} tone="tangerine" hint={`${data.listedCompanions} live on Explore`} />
        </Link>
        <Link href="/admin/users">
          <Stat label="Joined today" value={data.series.at(-1)?.signups ?? 0} tone="sky" hint={`${data.series.at(-2)?.signups ?? 0} yesterday`} />
        </Link>
      </div>
      {data.money && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Money received"
            value={formatINR(data.money.received.all)}
            tone="lime"
            hint={`Today ${formatINR(data.money.received.today)} · 30 days ${formatINR(data.money.received.month)}`}
          />
          <Stat
            label="Platform revenue"
            value={formatINR(data.money.revenue.total)}
            tone="pink"
            hint={`Meetups ${formatINR(data.money.revenue.meetups)} · Host fees ${formatINR(data.money.revenue.fees)} · Chats ${formatINR(data.money.revenue.chats)} · Premium ${formatINR(data.money.revenue.premium)}`}
          />
          <Stat label="GMV · in escrow" value={`${formatINR(data.gmv)} · ${formatINR(data.inEscrow)}`} tone="sky" hint="Meetup value (net of refunds) · held until meetups happen" />
          <Stat label="In members’ wallets" value={formatINR(data.money.wallets.total)} tone="sunny" hint={`${formatINR(data.money.wallets.total - data.money.wallets.credit)} money · ${formatINR(data.money.wallets.credit)} coins & credit`} />
        </div>
      )}
      <p className="mt-2 text-xs text-ink-mute">
        Money received = real payments through Razorpay ({formatINR(data.money?.byPurpose.fees ?? 0)} host fees · {formatINR(data.money?.byPurpose.coins ?? 0)} coins · {formatINR(data.money?.byPurpose.meetups ?? 0)} meetups · {formatINR(data.money?.byPurpose.premium ?? 0)} Premium); test payments aren’t counted. {data.users} members · {data.companions} hosts ({data.listedCompanions} live).
      </p>

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
