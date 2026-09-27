'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, Field, Input, Modal, StatusBadge, Tabs } from '@companio/ui';
import { ErrorBox, Loading, PageTitle } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { useAdminRealtime } from '@/admin/lib/realtime';
import { ago, dt } from '@/admin/lib/format';

export default function SosPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<'ACTIVE' | 'RESOLVED'>('ACTIVE');
  const { data, error, reload } = useLoad(() => api.admin.sos({ status }), [status]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useAdminRealtime({ 'sos:new': reload, 'sos:resolved': reload });

  return (
    <>
      <PageTitle title="SOS alerts" subtitle="Call the member first. Escalate to 112 / local police if you can’t reach them or they’re in danger." actions={<Tabs value={status} onChange={setStatus} items={[{ value: 'ACTIVE', label: 'Active' }, { value: 'RESOLVED', label: 'Resolved' }]} />} />
      {error && <ErrorBox error={error} />}
      {!data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Card className="p-10 text-center text-ink-mute">{status === 'ACTIVE' ? 'No active alerts. 🙏' : 'No history yet.'}</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((s) => (
            <Card key={s.id} tone={s.status === 'ACTIVE' ? 'pink' : 'white'} className="space-y-3 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-xl font-extrabold">🚨 {s.user.name}</p>
                  <p className="text-sm">
                    {dt(s.createdAt)} · {ago(s.createdAt)}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="rounded-chunky border-2 border-ink bg-white p-3 text-sm">
                <p>
                  📞 <a className="font-bold underline" href={`tel:${s.user.phone}`}>{s.user.phone}</a>
                </p>
                <p>
                  📍 {s.lat && s.lng ? (
                    <a className="font-bold underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${s.lat},${s.lng}`}>
                      {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                    </a>
                  ) : (
                    'location unavailable'
                  )}
                </p>
                <p>
                  🤝 {s.booking.userName} ↔ {s.booking.companionName} at {s.booking.meetingPoint}
                </p>
              </div>
              {s.source === 'TRUSTED_CONTACT' && (
                <p className="self-start rounded-full border-2 border-ink bg-sunny px-2.5 py-0.5 text-xs font-extrabold">👀 Raised by their trusted contact, not by {s.user.name ?? 'the user'}</p>
              )}
              {s.note && <p className="text-sm italic">“{s.note}”</p>}
              <div className="flex gap-2">
                <Link href={`/admin/bookings/${s.bookingId}`}>
                  <Button size="sm" variant="white">
                    Open booking
                  </Button>
                </Link>
                {s.status === 'ACTIVE' && (
                  <Button size="sm" variant="dark" onClick={() => setResolving(s.id)}>
                    Mark resolved
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={!!resolving}
        onClose={() => setResolving(null)}
        title="Resolve SOS"
        footer={
          <Button
            loading={busy}
            disabled={note.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                await api.admin.resolveSos(resolving!, note);
                toast('Resolved');
                setResolving(null);
                setNote('');
                reload();
              } catch (e) {
                toast(errMsg(e), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Resolve
          </Button>
        }
      >
        <Field label="What happened? (logged)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called member — safe, accidental press" />
        </Field>
      </Modal>
    </>
  );
}
