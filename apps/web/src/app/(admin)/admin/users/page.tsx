'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CITIES, GENDERS, ROLES, USER_STATUSES, cityBySlug } from '@companio/types';
import { Avatar, Input, Select, StatusBadge } from '@companio/ui';
import { AddUser } from '@/admin/components/add-user';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/admin/components/ui';
import { useAdmin, useLoad } from '@/admin/lib/api';
import { dtIST, formatINR, humanize } from '@/admin/lib/format';

export default function UsersPage() {
  const { api } = useAdmin();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const { data, error } = useLoad(() => api.admin.users({ q: query || undefined, role: role || undefined, status: status || undefined, gender: gender || undefined, city: city || undefined, source: (source || undefined) as 'admin' | 'self' | undefined, page }), [query, role, status, gender, city, source, page]);

  return (
    <>
      <PageTitle title="Users" actions={<AddUser />} />
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
        <Select className="max-w-[180px]" value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }} aria-label="Gender">
          <option value="">Any gender</option>
          {GENDERS.map((g) => <option key={g} value={g}>{humanize(g)}</option>)}
        </Select>
        <Select className="max-w-[200px]" value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} aria-label="City">
          <option value="">Any city</option>
          <option value="none">Not set</option>
          {[...CITIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Select>
        <Select className="max-w-[220px]" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} aria-label="How they joined">
          <option value="">Any sign-up</option>
          <option value="admin">🛠 Added by admin</option>
          <option value="self">Signed up themselves</option>
        </Select>
      </form>
      {error && <ErrorBox error={error} />}
      {!data ? (
        <Loading />
      ) : (
        <>
          <Table head={['User', 'Role', 'Gender', 'City', 'Bookings', 'Reports', 'Wallet', 'Joined (IST)', 'Status']} empty={data.items.length === 0}>
            {data.items.map((u) => (
              <tr key={u.id} className="hover:bg-paper">
                <Td>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2">
                    <Avatar name={u.name} src={u.avatarUrl} size={32} />
                    <span>
                      <span className="block font-bold underline">{u.name ?? '—'}</span>
                      <span className="text-xs text-ink-mute">{u.phone ?? (u.deletedPhone ? `${u.deletedPhone} (deleted)` : u.email)}</span>
                      {u.addedBy && (
                        <span className="mt-0.5 block w-fit whitespace-nowrap rounded-full border-2 border-ink bg-sky px-1.5 text-[11px] font-bold" title={`Added by ${u.addedBy.name ?? 'an admin'}`}>
                          🛠 Added by admin
                        </span>
                      )}
                    </span>
                  </Link>
                </Td>
                <Td>
                  {humanize(u.role)}
                  {u.companion && <span className="block text-xs text-ink-mute">KYC {u.companion.kycStatus.toLowerCase()}</span>}
                </Td>
                <Td className="text-sm">{u.gender ? humanize(u.gender) : '—'}</Td>
                <Td>{cityBySlug(u.city ?? '')?.name ?? '—'}</Td>
                <Td className="tabular-nums">{u.bookingsCount}</Td>
                <Td className={u.reportsAgainst ? 'font-bold text-danger' : ''}>{u.reportsAgainst}</Td>
                <Td className="tabular-nums">{formatINR(u.walletBalance)}</Td>
                <Td className="whitespace-nowrap text-xs">{dtIST(u.createdAt)}</Td>
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
