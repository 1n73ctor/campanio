'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ROLES, USER_STATUSES, cityBySlug } from '@companio/types';
import { Avatar, Input, Select, StatusBadge } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/components/ui';
import { useAdmin, useLoad } from '@/lib/api';
import { d, formatINR, humanize } from '@/lib/format';

export default function UsersPage() {
  const { api } = useAdmin();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, error } = useLoad(() => api.admin.users({ q: query || undefined, role: role || undefined, status: status || undefined, page }), [query, role, status, page]);

  return (
    <>
      <PageTitle title="Users" />
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q); setPage(1); }}>
        <Input className="max-w-xs" placeholder="Name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="max-w-[180px]" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">Members & companions</option>
          {ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
        </Select>
        <Select className="max-w-[180px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option>
          {USER_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
      </form>
      {error && <ErrorBox error={error} />}
      {!data ? (
        <Loading />
      ) : (
        <>
          <Table head={['User', 'Role', 'City', 'Bookings', 'Reports', 'Wallet', 'Joined', 'Status']} empty={data.items.length === 0}>
            {data.items.map((u) => (
              <tr key={u.id} className="hover:bg-paper">
                <Td>
                  <Link href={`/users/${u.id}`} className="flex items-center gap-2">
                    <Avatar name={u.name} src={u.avatarUrl} size={32} />
                    <span>
                      <span className="block font-bold underline">{u.name ?? '—'}</span>
                      <span className="text-xs text-ink-mute">{u.phone ?? u.email}</span>
                    </span>
                  </Link>
                </Td>
                <Td>
                  {humanize(u.role)}
                  {u.companion && <span className="block text-xs text-ink-mute">KYC {u.companion.kycStatus.toLowerCase()}</span>}
                </Td>
                <Td>{cityBySlug(u.city ?? '')?.name ?? '—'}</Td>
                <Td className="tabular-nums">{u.bookingsCount}</Td>
                <Td className={u.reportsAgainst ? 'font-bold text-danger' : ''}>{u.reportsAgainst}</Td>
                <Td className="tabular-nums">{formatINR(u.walletBalance)}</Td>
                <Td className="text-xs">{d(u.createdAt)}</Td>
                <Td><StatusBadge status={u.status} /></Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
    </>
  );
}
