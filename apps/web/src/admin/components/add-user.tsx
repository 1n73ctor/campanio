'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@companio/api-client';
import { CITIES, GENDERS, MIN_AGE, ageFromDob } from '@companio/types';
import { Button, Callout, Field, Input, Modal, Select, Toggle } from '@companio/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin } from '@/admin/lib/api';
import { humanize } from '@/admin/lib/format';

const EMPTY = { phone: '', name: '', email: '', emailVerified: false, dob: '', gender: '', city: '', sendInvite: true, note: '' };

/**
 * Admin → Users → Add user: creates a member account for a mobile number. They sign in with that number (one-time
 * code) and finish onboarding themselves — accepting the guidelines can't be done for them.
 */
export function AddUser() {
  const { api } = useAdmin();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);

  const phoneOk = /^[6-9]\d{9}$/.test(f.phone);
  const emailOk = !f.email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim());
  const age = f.dob ? ageFromDob(f.dob) : null;
  const dobOk = !f.dob || (age !== null && age >= MIN_AGE);
  const ok = phoneOk && f.name.trim().length >= 2 && emailOk && dobOk;

  const save = async () => {
    setBusy(true);
    setError(null);
    setExisting(null);
    try {
      const r = await api.admin.createUser({
        phone: f.phone,
        name: f.name.trim(),
        email: f.email.trim() || undefined,
        emailVerified: f.email ? f.emailVerified : undefined,
        dob: f.dob || undefined,
        gender: f.gender || undefined,
        city: f.city || undefined,
        sendInvite: !!f.email && f.sendInvite,
        note: f.note.trim() || undefined,
      });
      toast(r.invited ? 'User added — we emailed them how to sign in' : 'User added — they can sign in with their number');
      setOpen(false);
      setF(EMPTY);
      router.push(`/admin/users/${r.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setExisting((e.body as { userId?: string } | undefined)?.userId ?? null);
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Add user</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a user"
        footer={
          <Button loading={busy} disabled={!ok} onClick={save}>
            Create account
          </Button>
        }
      >
        <div className="space-y-3 text-sm">
          <Field label="Mobile number" hint="They sign in with this number — we send them a one-time code" error={f.phone && !phoneOk ? 'Enter a valid 10-digit mobile number' : null}>
            <div className="flex">
              <span className="flex h-11 items-center rounded-l-chunky border-3 border-r-0 border-ink bg-paper-deep px-3 font-bold">+91</span>
              <Input className="rounded-l-none" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(-10) })} placeholder="98765 43210" />
            </div>
          </Field>
          <Field label="Name">
            <Input value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Priya Sharma" />
          </Field>
          <Field label="Email (optional)" error={!emailOk ? 'Enter a valid email address' : null}>
            <Input type="email" value={f.email} maxLength={254} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="priya@example.com" />
          </Field>
          {f.email && (
            <div className="flex flex-wrap gap-5">
              <label className="flex cursor-pointer items-center gap-2 font-semibold"><Toggle checked={f.sendInvite} onChange={(v) => setF({ ...f, sendInvite: v })} label="Email them how to sign in" /><span>Email them how to sign in</span></label>
              <label className="flex cursor-pointer items-center gap-2 font-semibold"><Toggle checked={f.emailVerified} onChange={(v) => setF({ ...f, emailVerified: v })} label="Email already confirmed" /><span>Email already confirmed</span></label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth (optional)" error={!dobOk ? `Must be ${MIN_AGE}+` : null}>
              <Input type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
            </Field>
            <Field label="Gender (optional)">
              <Select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
                <option value="">—</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {humanize(g)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="City (optional)">
            <Select value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
              <option value="">—</option>
              {[...CITIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note for the audit log (optional)">
            <Input value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Signed up at the Delhi meetup" />
          </Field>
          <Callout tone="sky">
            They’ll accept the community guidelines and check their details the first time they sign in — that’s also when they get their welcome credit. Gender and date of
            birth can’t be changed by them after that, so get them right.
          </Callout>
          {error && (
            <p className="font-semibold text-danger">
              {error}
              {existing && (
                <>
                  {' '}
                  —{' '}
                  <a href={`/admin/users/${existing}`} className="underline">
                    open their account
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
