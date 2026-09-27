'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ModerationAction, ReportDto } from '@companio/types';
import { Badge, Button, Checkbox, Field, Modal, StatusBadge, Tabs, Textarea, cn } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { dt, humanize } from '@/admin/lib/format';

export default function ModerationPage() {
  const [tab, setTab] = useState<'reports' | 'flagged'>('reports');
  return (
    <>
      <PageTitle title="Moderation" subtitle="Platonic-only. Sexual solicitation, harassment and off-platform payment pushes are the top violations." actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'reports', label: 'Reports' }, { value: 'flagged', label: 'Flagged messages' }]} />} />
      {tab === 'reports' ? <Reports /> : <Flagged />}
    </>
  );
}

function Reports() {
  const { api } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<'OPEN' | 'ACTIONED' | 'DISMISSED'>('OPEN');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad(() => api.admin.reports({ status, page }), [status, page]);
  const [sel, setSel] = useState<ReportDto | null>(null);
  const [action, setAction] = useState<ModerationAction>('WARN');
  const [hide, setHide] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: 'OPEN', label: 'Open' }, { value: 'ACTIONED', label: 'Actioned' }, { value: 'DISMISSED', label: 'Dismissed' }]} />
      {error && <ErrorBox error={error} />}
      {!data ? (
        <Loading />
      ) : (
        <>
          <Table head={['Reported', 'Reason', 'Evidence', 'Reporter', 'When', '']} empty={data.items.length === 0}>
            {data.items.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/admin/users/${r.target.id}`} className="font-bold underline">
                    {r.target.name}
                  </Link>
                  <div className="mt-1">
                    <StatusBadge status={r.target.status} />
                  </div>
                </Td>
                <Td>
                  <Badge tone={r.reason === 'SEXUAL_CONTENT' || r.reason === 'SAFETY_CONCERN' ? 'danger' : 'sunny'}>{humanize(r.reason)}</Badge>
                  {r.details && <p className="mt-1 max-w-xs text-xs text-ink-soft">{r.details}</p>}
                </Td>
                <Td>
                  {r.message ? <p className="max-w-xs rounded-lg bg-paper px-2 py-1 text-xs">“{r.message.body}”</p> : '—'}
                  {r.bookingId && (
                    <Link href={`/admin/bookings/${r.bookingId}`} className="mt-1 block text-xs underline">
                      booking →
                    </Link>
                  )}
                </Td>
                <Td>{r.reporter.name}</Td>
                <Td className="whitespace-nowrap text-xs">{dt(r.createdAt)}</Td>
                <Td>
                  {r.status === 'OPEN' ? (
                    <Button size="sm" variant="dark" onClick={() => { setSel(r); setAction('WARN'); setHide(!!r.message); }}>
                      Review
                    </Button>
                  ) : (
                    <span className="text-xs">{r.action} · {r.resolution}</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
      <Modal
        open={!!sel}
        onClose={() => setSel(null)}
        title={`Action on ${sel?.target.name}`}
        footer={
          <Button
            variant={action === 'BAN' ? 'danger' : 'primary'}
            loading={busy}
            disabled={note.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                await api.admin.resolveReport(sel!.id, { action, hideMessage: hide && !!sel?.message, note });
                toast('Report handled');
                setSel(null);
                setNote('');
                reload();
              } catch (e) {
                toast(errMsg(e), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Apply
          </Button>
        }
      >
        <div className="grid grid-cols-4 gap-2">
          {(['DISMISS', 'WARN', 'SUSPEND', 'BAN'] as const).map((a) => (
            <button key={a} onClick={() => setAction(a)} className={cn('rounded-chunky border-3 border-ink py-2 text-sm font-bold', action === a ? (a === 'BAN' ? 'bg-danger text-white' : 'bg-ink text-paper') : 'bg-white')}>
              {humanize(a)}
            </button>
          ))}
        </div>
        {sel?.message && <Checkbox checked={hide} onChange={(e) => setHide(e.target.checked)} label="Hide the reported message from the chat" />}
        <Field label={action === 'WARN' ? 'Warning text (sent to user)' : 'Internal note'}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}

function Flagged() {
  const { api } = useAdmin();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad(() => api.admin.flaggedMessages({ page }), [page]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <p className="mb-3 text-sm text-ink-soft">Auto-flagged by the chat filter (contact details masked, explicit language). Hide anything that breaks the guidelines; report the sender from the Users page for repeat offences.</p>
      <Table head={['Message', 'Why', 'Sender', 'When', '']} empty={data.items.length === 0}>
        {data.items.map((m) => (
          <tr key={m.id} className={m.hidden ? 'opacity-50' : ''}>
            <Td>
              <p className="max-w-md">“{m.body}”</p>
              <Link href={`/admin/bookings/${m.bookingId}`} className="text-xs underline">
                booking →
              </Link>
            </Td>
            <Td>
              {(m.flagReason ?? '').split(',').filter(Boolean).map((r) => (
                <Badge key={r} tone={r === 'explicit' ? 'danger' : 'sunny'} className="mr-1">
                  {r}
                </Badge>
              ))}
            </Td>
            <Td>
              <Link href={`/admin/users/${m.sender.id}`} className="underline">
                {m.sender.name}
              </Link>
            </Td>
            <Td className="whitespace-nowrap text-xs">{dt(m.createdAt)}</Td>
            <Td>
              <Button
                size="sm"
                variant="white"
                onClick={async () => {
                  try {
                    await api.admin.setMessageHidden(m.id, !m.hidden);
                    reload();
                  } catch (e) {
                    toast(errMsg(e), 'error');
                  }
                }}
              >
                {m.hidden ? 'Unhide' : 'Hide'}
              </Button>
            </Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
    </>
  );
}
