'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CITIES } from '@companio/types';
import { Avatar, Button, Card, Field, Input, Modal, Select, Textarea } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader, PageHeader } from '@/components/misc';
import { useToast } from '@/components/toast';
import { errMsg, fmtDate } from '@/lib/format';

export default function AccountPage() {
  const user = useRequireAuth();
  const { api, setUser, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', city: '', bio: '' });
  const [blocks, setBlocks] = useState<{ userId: string; name: string | null; avatarUrl: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setForm({ name: user.name ?? '', city: user.city ?? '', bio: user.bio ?? '' });
    api.me.blocks().then(setBlocks).catch(() => {});
  }, [user, api]);

  if (!user) return <FullLoader />;

  const save = async () => {
    setBusy(true);
    try {
      setUser(await api.me.update({ name: form.name, city: form.city, bio: form.bio }));
      toast('Profile saved');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
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

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.me.deleteAccount();
      signOut();
      router.replace('/?deleted=1');
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
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
        <Field label="City">
          <Select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bio">
          <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={500} />
        </Field>
        <Button loading={busy} onClick={save}>
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

      <Card tone="pink" className="mt-6 p-6">
        <h2 className="font-display text-lg font-extrabold">Delete account</h2>
        <p className="mt-1 text-sm text-ink-soft">Permanently removes your profile and personal data. Finish or cancel active bookings and withdraw any wallet balance first.</p>
        <Button variant="danger" className="mt-4" onClick={() => setDel(true)}>
          Delete my account
        </Button>
      </Card>

      <Modal
        open={del}
        onClose={() => setDel(false)}
        title="Delete account?"
        footer={
          <Button variant="danger" loading={busy} disabled={confirmText !== 'DELETE'} onClick={deleteAccount}>
            Permanently delete
          </Button>
        }
      >
        <p>This can’t be undone. Type <b>DELETE</b> to confirm.</p>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </Modal>
    </div>
  );
}
