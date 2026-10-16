'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, Button, Card, Field, Input, Textarea } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader, PageHeader } from '@/components/misc';
import { CityPicker } from '@/components/city-picker';
import { useToast } from '@/components/toast';
import { errMsg, fmtDate } from '@/lib/format';
import { DeleteAccount } from '@/components/delete-account';
import { SessionsCard } from '@/components/sessions-card';

export default function AccountPage() {
  const user = useRequireAuth();
  const { api, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', city: '', bio: '' });
  const [blocks, setBlocks] = useState<{ userId: string; name: string | null; avatarUrl: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setForm({ name: user.name ?? '', email: user.email ?? '', city: user.city ?? '', bio: user.bio ?? '' });
    api.me.blocks().then(setBlocks).catch(() => {});
  }, [user, api]);

  if (!user) return <FullLoader />;

  const email = form.email.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  const save = async () => {
    setBusy(true);
    try {
      const changed = !!email && email.toLowerCase() !== (user.email ?? '').toLowerCase();
      setUser(await api.me.update({ name: form.name, city: form.city, bio: form.bio, ...(email ? { email } : {}) }));
      toast(changed ? 'Saved — check your inbox to verify your new email' : 'Profile saved');
      if (changed) setResent(true);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setSending(true);
    try {
      const r = await api.me.resendEmailVerification();
      if (r.verified) setUser(await api.me.get());
      else setResent(true);
      toast(r.verified ? 'Your email is already verified' : 'Verification link sent — check your inbox (and spam folder)');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    try {
      setUser(await api.me.uploadAvatar(f));
      toast('Photo updated');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };


  return (
    <div className="container-x max-w-2xl pb-10">
      <PageHeader title="Account" subtitle={`${user.phone} · member since ${fmtDate(user.createdAt)}`} />
      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} src={user.avatarUrl} size={80} />
          <div>
            <Button variant="white" size="sm" onClick={() => fileRef.current?.click()}>
              Change photo
            </Button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
            <p className="mt-1 text-xs text-ink-mute">A clear face photo builds trust. JPG/PNG up to 5MB.</p>
          </div>
        </div>
        <Field label="Name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} />
        </Field>
        <Field
          label="Email"
          hint={user.email ? 'For meetup receipts and important account updates. Never shown to anyone.' : 'Add your email for meetup receipts and important account updates.'}
          error={email && !emailOk ? 'Enter a valid email address' : null}
        >
          <Input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={254} placeholder="you@example.com" />
        </Field>
        {user.email && email.toLowerCase() === user.email.toLowerCase() &&
          (user.emailVerified ? (
            <p className="-mt-2 text-sm font-semibold text-ink-soft">✓ Email verified</p>
          ) : (
            <div className="-mt-2 rounded-2xl border-2 border-ink bg-sunny p-3 text-sm">
              <p className="font-semibold">⚠️ Your email isn’t verified yet</p>
              <p className="mt-1 text-ink-soft">We can’t send meetup emails, reminders or receipts until you verify it.{resent ? ' We sent you a link — check your inbox and spam folder.' : ''}</p>
              <Button size="sm" className="mt-3" loading={sending} onClick={resend}>
                {resent ? 'Send the link again' : 'Verify email'}
              </Button>
            </div>
          ))}
        <Field label="City">
          <CityPicker value={form.city} onChange={(city) => setForm({ ...form, city })} />
        </Field>
        <Field label="Bio">
          <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={500} />
        </Field>
        <Button loading={busy} disabled={!!email && !emailOk} onClick={save}>
          Save changes
        </Button>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-3 font-display text-lg font-extrabold">Blocked people</h2>
        {blocks.length === 0 ? (
          <p className="text-sm text-ink-soft">You haven’t blocked anyone.</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li key={b.userId} className="flex items-center gap-3">
                <Avatar name={b.name} src={b.avatarUrl} size={36} />
                <span className="flex-1 font-semibold">{b.name}</span>
                <Button
                  size="sm"
                  variant="white"
                  onClick={async () => {
                    await api.me.unblock(b.userId);
                    setBlocks((x) => x.filter((y) => y.userId !== b.userId));
                  }}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SessionsCard />
      <DeleteAccount />
    </div>
  );
}
