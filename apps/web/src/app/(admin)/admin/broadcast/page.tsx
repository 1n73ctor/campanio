'use client';

import { useEffect, useState } from 'react';
import { CITIES } from '@companio/types';
import { Button, Callout, Card, Field, Input, Modal, Select, Tabs, Textarea } from '@companio/ui';
import { PageTitle } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { BROADCAST_TEMPLATES } from '@/admin/lib/message-templates';
import { errMsg, useAdmin } from '@/admin/lib/api';

type Audience = 'ALL' | 'MEMBERS' | 'HOSTS';
const AUDIENCE_LABEL: Record<Audience, string> = { ALL: 'everyone', MEMBERS: 'members', HOSTS: 'hosts' };

const LINKS = [
  ['', '— none —'],
  ['/explore', 'Explore'],
  ['/explore/festival-buddy', 'Explore · Festival Buddy'],
  ['/bookings', 'Meetups'],
  ['/wallet', 'Wallet'],
  ['/account', 'Account'],
  ['/become-a-companion', 'Become a host'],
  ['/companion/dashboard', 'Host dashboard'],
  ['/community-guidelines', 'Community guidelines'],
  ['/safety', 'Safety'],
] as const;

/** Send one message to many people's notifications. */
export default function BroadcastPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const [audience, setAudience] = useState<Audience>('ALL');
  const [city, setCity] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [msg, setMsg] = useState({ title: '', body: '', link: '' });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setCount(null);
    api.admin
      .broadcastAudience(audience, city || undefined)
      .then((r) => live && setCount(r.count))
      .catch(() => live && setCount(0));
    return () => {
      live = false;
    };
  }, [api, audience, city]);

  const ready = msg.title.trim().length >= 3 && msg.body.trim().length >= 3 && !!count;
  const who = `${count ?? '…'} ${AUDIENCE_LABEL[audience]}${city ? ` in ${CITIES.find((c) => c.slug === city)?.name}` : ''}`;

  const send = async () => {
    if (count === null) return;
    setBusy(true);
    try {
      const r = await api.admin.broadcast({ title: msg.title.trim(), body: msg.body.trim(), link: msg.link || undefined, audience, city: city || undefined, expectedCount: count });
      toast(`Sent to ${r.sent} people`);
      setMsg({ title: '', body: '', link: '' });
      setConfirm(false);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Broadcast" subtitle="Send one message to many people. It appears in their notifications (live for anyone online), marked “From the Companio team”." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="space-y-4 p-6">
          <Field label="Send to">
            <Tabs value={audience} onChange={setAudience} items={[{ value: 'ALL', label: 'Everyone' }, { value: 'MEMBERS', label: 'Members' }, { value: 'HOSTS', label: 'Hosts' }]} />
          </Field>
          <Field label="City">
            <Select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">All cities</option>
              {[...CITIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-1.5 font-display text-sm font-bold">Start from a template</p>
            <div className="flex flex-wrap gap-2">
              {BROADCAST_TEMPLATES.map((tpl) => (
                <Button key={tpl.label} size="sm" variant="white" onClick={() => setMsg({ title: tpl.title, body: tpl.body, link: tpl.link })}>
                  {tpl.label}
                </Button>
              ))}
            </div>
          </div>
          <Field label="Title">
            <Input value={msg.title} maxLength={80} onChange={(e) => setMsg({ ...msg, title: e.target.value })} placeholder="Diwali Food Walks are here 🪔" />
          </Field>
          <Field label={`Message (${msg.body.length}/1000)`}>
            <Textarea value={msg.body} maxLength={1000} className="min-h-[140px]" onChange={(e) => setMsg({ ...msg, body: e.target.value })} placeholder="Hi! …" />
          </Field>
          <Field label="Opens this page when tapped (optional)">
            <Select value={msg.link} onChange={(e) => setMsg({ ...msg, link: e.target.value })}>
              {LINKS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Button size="lg" disabled={!ready} onClick={() => setConfirm(true)}>
            Send to {who}
          </Button>
        </Card>
        <div className="space-y-4">
          <Callout tone="sky" title="Reaches">
            <span className="font-display text-3xl font-extrabold">{count ?? '…'}</span> active {AUDIENCE_LABEL[audience]}
            {city && <> in {CITIES.find((c) => c.slug === city)?.name}</>}. Suspended, banned and deleted accounts are never included.
          </Callout>
          <Card className="p-4 text-sm">
            <p className="mb-2 text-xs font-bold uppercase text-ink-mute">Preview</p>
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-3 border-ink bg-pink text-lg">📣</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-pink-deep">From the Companio team</p>
                <p className="font-display font-extrabold">{msg.title || 'Your title'}</p>
                <p className="whitespace-pre-line text-ink-soft">{msg.body || 'Your message'}</p>
              </div>
            </div>
          </Card>
          <p className="text-xs text-ink-mute">Use it sparingly — a few useful messages a month. Every broadcast is recorded in the Audit log.</p>
        </div>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Send this broadcast?"
        footer={
          <Button loading={busy} onClick={send}>
            Yes, send to {count}
          </Button>
        }
      >
        <p className="text-sm">
          “<b>{msg.title}</b>” goes to <b>{who}</b> right away. It can’t be unsent.
        </p>
      </Modal>
    </>
  );
}
