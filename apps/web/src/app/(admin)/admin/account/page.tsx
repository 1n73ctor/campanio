'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Field, Input } from '@companio/ui';
import { PageTitle } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { TwoFactorCard } from '@/admin/components/two-factor';
import { errMsg, useAdmin } from '@/admin/lib/api';

/** The signed-in admin's own account: name, sign-in email, password and two-factor sign-in. */
export default function AdminAccountPage() {
  const { api, admin, token, signIn } = useAdmin();
  const toast = useToast();
  const [profile, setProfile] = useState({ name: '', email: '', currentPassword: '' });
  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null);

  useEffect(() => {
    if (admin) setProfile((p) => ({ ...p, name: admin.name ?? '', email: admin.email ?? '' }));
  }, [admin]);
  if (!admin) return null;

  const emailChanged = profile.email.trim().toLowerCase() !== (admin.email ?? '').toLowerCase();
  const profileChanged = profile.name.trim() !== (admin.name ?? '') || emailChanged;

  const saveProfile = async () => {
    setBusy('profile');
    try {
      const u = await api.admin.updateMe({
        name: profile.name.trim(),
        ...(emailChanged ? { email: profile.email.trim(), currentPassword: profile.currentPassword } : {}),
      });
      if (token) signIn(token, u);
      setProfile((p) => ({ ...p, currentPassword: '' }));
      toast(emailChanged ? 'Saved — sign in with your new email from now on' : 'Saved');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const tooShort = pw.next.length > 0 && pw.next.length < 12;
  const mismatch = pw.repeat.length > 0 && pw.next !== pw.repeat;
  const changePassword = async () => {
    setBusy('password');
    try {
      const r = await api.admin.changePassword(pw.current, pw.next);
      signIn(r.token, r.user); // this session stays signed in; other devices are signed out
      setPw({ current: '', next: '', repeat: '' });
      toast('Password changed — other devices were signed out');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle title="👤 My account" subtitle="Your admin profile, password and two-factor sign-in." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h2 className="font-display text-lg font-extrabold">Profile</h2>
          <Field label="Name">
            <Input value={profile.name} maxLength={60} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </Field>
          <Field label="Sign-in email" hint="You sign in to the admin panel with this email.">
            <Input type="email" autoComplete="username" value={profile.email} maxLength={254} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
          </Field>
          {emailChanged && (
            <Field label="Current password" hint="Needed to change your sign-in email. Your old email gets a notice.">
              <Input type="password" autoComplete="current-password" value={profile.currentPassword} onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })} />
            </Field>
          )}
          <Button loading={busy === 'profile'} disabled={!profileChanged || profile.name.trim().length < 2 || (emailChanged && !profile.currentPassword)} onClick={saveProfile}>
            Save profile
          </Button>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="font-display text-lg font-extrabold">Change password</h2>
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="New password" hint="At least 12 characters. A short sentence is easy to remember and hard to guess." error={tooShort ? 'Use at least 12 characters' : null}>
            <Input type="password" autoComplete="new-password" value={pw.next} maxLength={128} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="Repeat new password" error={mismatch ? 'The passwords don’t match' : null}>
            <Input type="password" autoComplete="new-password" value={pw.repeat} maxLength={128} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} />
          </Field>
          <Button loading={busy === 'password'} disabled={!pw.current || pw.next.length < 12 || pw.next !== pw.repeat} onClick={changePassword}>
            Change password
          </Button>
          <p className="text-xs text-ink-mute">Changing it signs out every other device using this account. You stay signed in here, and get an email confirming the change.</p>
        </Card>

        <div className="lg:col-span-2">
          <TwoFactorCard />
        </div>
      </div>
    </>
  );
}
