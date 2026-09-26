'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BOOKING_STATUSES } from '@companio/types';
import { Input, Select, StatusBadge } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/components/ui';
import { useAdmin, useLoad } from '@/lib/api';
import { BOOKING_STATUS_LABEL, dt, formatINR, humanize } from '@/lib/format';

function BookingsInner() {
  const { api } = useAdmin();
  const [status, setStatus] = useState(useSearchParams().get('status') ?? '');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, error } = useLoad(() => api.admin.bookings({ status: status || undefined, q: query || undefined, page }), [status, query, page]);

  return (
    <>
      <PageTitle title="Bookings & refunds" subtitle="Open a booking to see chat, payments, escrow, SOS history and to issue refunds." />
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q); setPage(1); }}>
        <Input className="max-w-xs" placeholder="Search id, member or companion" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="max-w-[220px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </form>
      {error && <ErrorBox error={error} />}
      {!data ? (
        <Loading />
      ) : (
        <>
          <Table head={['Booking', 'Member', 'Companion', 'When', 'Total', 'Escrow', 'Status']} empty={data.items.length === 0}>
            {data.items.map((b) => (
              <tr key={b.id} className="hover:bg-paper">
                <Td>
                  <Link href={`/bookings/${b.id}`} className="font-mono text-xs font-bold underline">
                    {b.id.slice(-8)}
                  </Link>
                  <p className="text-xs">{humanize(b.category)}</p>
                </Td>
                <Td>{b.user.name}</Td>
                <Td>{b.companion.name}</Td>
                <Td className="whitespace-nowrap text-xs">{dt(b.startAt)}</Td>
                <Td className="tabular-nums">{formatINR(b.total)}</Td>
                <Td>{b.escrow ? <StatusBadge status={b.escrow.status} /> : '—'}</Td>
                <Td>
                  <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
                </Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
    </>
  );
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsInner />
    </Suspense>
  );
}
