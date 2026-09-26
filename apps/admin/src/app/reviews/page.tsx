'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errMsg, useAdmin, useLoad } from '@/lib/api';
import { dt } from '@/lib/format';

export default function ReviewsPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad(() => api.admin.reviews({ page }), [page]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageTitle title="Reviews" subtitle="Hide reviews that contain personal info, abuse or fake content. Ratings recompute automatically." />
      <Table head={['Rating', 'Comment', 'By', 'For', 'When', '']} empty={data.items.length === 0}>
        {data.items.map((r) => (
          <tr key={r.id} className={r.hidden ? 'opacity-50' : ''}>
            <Td className="whitespace-nowrap text-sunny-deep">{'★'.repeat(r.rating)}</Td>
            <Td><p className="max-w-md">{r.comment ?? '—'}</p></Td>
            <Td><Link href={`/users/${r.author.id}`} className="underline">{r.author.name}</Link></Td>
            <Td><Link href={`/users/${r.target.id}`} className="underline">{r.target.name}</Link></Td>
            <Td className="whitespace-nowrap text-xs">{dt(r.createdAt)}</Td>
            <Td>
              <Button size="sm" variant="white" onClick={async () => { try { await api.admin.setReviewHidden(r.id, !r.hidden); reload(); } catch (e) { toast(errMsg(e), 'error'); } }}>
                {r.hidden ? 'Unhide' : 'Hide'}
              </Button>
            </Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
    </>
  );
}
