'use client';

import { useState } from 'react';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/components/ui';
import { useAdmin, useLoad } from '@/lib/api';
import { dt } from '@/lib/format';

export default function AuditPage() {
  const { api } = useAdmin();
  const [page, setPage] = useState(1);
  const { data, error } = useLoad(() => api.admin.audit({ page }), [page]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageTitle title="Audit log" subtitle="Every admin action that changes money, users or content." />
      <Table head={['When', 'Admin', 'Action', 'Target', 'Details']} empty={data.items.length === 0}>
        {data.items.map((a) => (
          <tr key={a.id}>
            <Td className="whitespace-nowrap text-xs">{dt(a.createdAt)}</Td>
            <Td>{a.admin.name}</Td>
            <Td className="font-mono text-xs font-bold">{a.action}</Td>
            <Td className="font-mono text-xs">{a.targetType}:{a.targetId.slice(-8)}</Td>
            <Td><code className="block max-w-md truncate text-xs text-ink-soft" title={a.meta ?? ''}>{a.meta}</code></Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
    </>
  );
}
