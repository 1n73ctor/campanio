'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PremiumKind } from '@companio/api-client';
import { Button, Callout, Card, Stat, cn } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { dtIST, formatINR } from '@/admin/lib/format';

const KIND: Record<PremiumKind, string> = { HOST: 'One host', PASS_30: '30-day pass', LIFETIME: 'Lifetime' };

/** ⭐ Premium hosts: who is Premium, who unlocked them, and what it earned (all of it stays with the platform). */
export default function PremiumPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad(() => api.admin.premium(page), [page]);
  const { data: settings } = useLoad(() => api.admin.settings(), []);

  const off = async (userId: string, name: string | null) => {
    if (!confirm(`Remove Premium from ${name ?? 'this host'}? Their profile becomes visible to everyone again.`)) return;
    try {
      await api.admin.setPremium(userId, false);
      toast('Premium removed');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  return (
    <>
      <PageTitle
        title="👑 Premium hosts"
        subtitle="Members see a blurred profile until they unlock it. Unlock money is real money only (gateway or bought coins) and stays with the platform."
      />
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Premium hosts" tone="sunny" value={data.summary.premiumHosts} />
            <Stat label="Unlock revenue" tone="lime" value={formatINR(data.summary.revenue)} hint={`${data.summary.unlocks} unlock${data.summary.unlocks === 1 ? '' : 's'}`} />
            {(['PASS_30', 'LIFETIME'] as const).map((k) => (
              <Stat key={k} label={KIND[k]} value={data.summary.byKind[k]?.count ?? 0} hint={formatINR(data.summary.byKind[k]?.revenue ?? 0)} />
            ))}
          </div>

          {settings && (
            <Callout tone="sky" className="mb-6">
              Prices: <b>{formatINR(settings.premiumHostPrice)}</b> one host · <b>{formatINR(settings.premiumPassPrice)}</b> all for 30 days ·{' '}
              <b>{formatINR(settings.premiumLifetimePrice)}</b> lifetime.{' '}
              <Link href="/admin/settings" className="font-semibold underline">
                Change in Settings
              </Link>
              . To make a host Premium, open them in{' '}
              <Link href="/admin/users" className="font-semibold underline">
                Users
              </Link>{' '}
              (verified hosts only).
            </Callout>
          )}

          <h2 className="mb-3 text-xl font-extrabold">Premium hosts</h2>
          {data.hosts.length === 0 ? (
            <Card className="mb-8 p-5 text-sm text-ink-soft">No Premium hosts yet. Open a verified host in Users and switch on ⭐ Premium.</Card>
          ) : (
            <div className="mb-8">
              <Table head={['Host', 'Premium since', 'Unlocked by', '']} empty={false}>
                {data.hosts.map((h) => (
                  <tr key={h.userId}>
                    <Td>
                      <Link href={`/admin/users/${h.userId}`} className="font-semibold underline">
                        {h.name ?? 'Host'}
                      </Link>
                      <p className="text-xs text-ink-mute">{h.phone}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{h.since ? dtIST(h.since) : '—'}</Td>
                    <Td className="tabular-nums">{h.unlocks} member{h.unlocks === 1 ? '' : 's'}</Td>
                    <Td>
                      <Button size="sm" variant="white" onClick={() => off(h.userId, h.name)}>
                        Remove Premium
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Table>
            </div>
          )}

          <h2 className="mb-3 text-xl font-extrabold">Unlocks</h2>
          <Table head={['When (IST)', 'Member', 'Bought', 'Host', 'Paid', 'With', 'Valid until']} empty={data.items.length === 0}>
            {data.items.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-xs">{dtIST(r.createdAt)}</Td>
                <Td>
                  <Link href={`/admin/users/${r.member.id}`} className="font-semibold underline">
                    {r.member.name ?? 'Member'}
                  </Link>
                  <p className="text-xs text-ink-mute">{r.member.phone}</p>
                </Td>
                <Td>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', r.kind === 'HOST' ? 'bg-paper-deep' : r.kind === 'PASS_30' ? 'bg-sky' : 'bg-sunny')}>{KIND[r.kind]}</span>
                </Td>
                <Td>
                  {r.host ? (
                    <Link href={`/admin/users/${r.host.id}`} className="underline">
                      {r.host.name ?? 'Host'}
                    </Link>
                  ) : (
                    <span className="text-ink-mute">All Premium</span>
                  )}
                </Td>
                <Td className="font-semibold tabular-nums">{formatINR(r.price)}</Td>
                <Td className="text-xs">{r.paidWith === 'GATEWAY' ? 'UPI / card' : 'Bought coins'}</Td>
                <Td className="whitespace-nowrap text-xs">{r.kind === 'PASS_30' && r.expiresAt ? dtIST(r.expiresAt) : r.kind === 'LIFETIME' ? 'Forever' : '—'}</Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
    </>
  );
}
