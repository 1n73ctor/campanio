'use client';

import { useState } from 'react';
import { CATEGORIES, CITIES, GENDERS, LANGUAGES, humanize, type UserDto } from '@companio/types';
import type { AdminEditUserInput } from '@companio/api-client';
import { Button, Card, Field, Input, Modal, Select, Textarea } from '@companio/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin } from '@/admin/lib/api';

type U = UserDto;
const formOf = (u: U) => ({
  name: u.name ?? '',
  email: u.email ?? '',
  emailVerified: u.emailVerified,
  dob: u.dob?.slice(0, 10) ?? '',
  gender: u.gender ?? '',
  city: u.city ?? '',
  bio: u.bio ?? '',
  headline: u.companion?.headline ?? '',
  about: u.companion?.about ?? '',
  hourlyRate: String(u.companion?.hourlyRate ?? ''),
  categories: u.companion?.categories ?? [],
  languages: u.companion?.languages ?? [],
  hostCity: u.companion?.city ?? '',
  womenOnly: u.companion?.womenOnly ?? false,
});
type Form = ReturnType<typeof formOf>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function Chips({ options, value, max, onChange }: { options: { value: string; label: string }[]; value: string[]; max: number; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o.value) : value.length < max ? [...value, o.value] : value)}
            className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-semibold ${on ? 'bg-lime' : 'bg-white'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Edit any member's or host's profile. Only changed fields are sent; the reason goes in the audit log. */
export function EditUserModal({ user, open, onClose, onSaved }: { user: U; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { api } = useAdmin();
  const toast = useToast();
  const initial = formOf(user);
  const [f, setF] = useState<Form>(initial);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const input: AdminEditUserInput = { reason: reason.trim() };
  if (f.name.trim() !== initial.name) input.name = f.name.trim();
  if (f.email.trim().toLowerCase() !== initial.email.toLowerCase()) input.email = f.email.trim().toLowerCase();
  if (f.emailVerified !== initial.emailVerified) input.emailVerified = f.emailVerified;
  if (f.dob && f.dob !== initial.dob) input.dob = f.dob;
  if (f.gender && f.gender !== initial.gender) input.gender = f.gender;
  if (f.city && f.city !== initial.city) input.city = f.city;
  if (f.bio !== initial.bio) input.bio = f.bio;
  if (user.companion) {
    const c: NonNullable<AdminEditUserInput['companion']> = {};
    if (f.headline.trim() !== initial.headline) c.headline = f.headline.trim();
    if (f.about.trim() !== initial.about) c.about = f.about.trim();
    if (f.hourlyRate !== initial.hourlyRate) c.hourlyRate = Number(f.hourlyRate);
    if (!same(f.categories, initial.categories)) c.categories = f.categories;
    if (!same(f.languages, initial.languages)) c.languages = f.languages;
    if (f.hostCity !== initial.hostCity) c.city = f.hostCity;
    if (f.womenOnly !== initial.womenOnly) c.womenOnly = f.womenOnly;
    if (Object.keys(c).length) input.companion = c;
  }
  const changed = Object.keys(input).length > 1;
  const emailOk = !f.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim());

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.admin.editUser(user.id, input);
      toast(`Saved: ${r.changed.join(', ')}`);
      setReason('');
      onSaved();
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${user.name ?? 'profile'}`}
      footer={
        <Button loading={busy} disabled={!changed || reason.trim().length < 3 || !emailOk} onClick={save}>
          Save changes
        </Button>
      }
    >
      <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1 text-sm">
        <p className="text-ink-soft">Phone number, role and account status can’t be changed here. The person gets an in-app note listing what changed.</p>
        <Field label="Name">
          <Input value={f.name} maxLength={60} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Email" error={emailOk ? null : 'Enter a valid email address'} hint="A new email is sent a verification link unless you tick “verified”.">
          <Input type="email" value={f.email} maxLength={254} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.emailVerified} onChange={(e) => set('emailVerified', e.target.checked)} /> Email verified
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date of birth">
            <Input type="date" value={f.dob} onChange={(e) => set('dob', e.target.value)} />
          </Field>
          <Field label="Gender">
            <Select value={f.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {humanize(g)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="City">
          <Select value={f.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">—</option>
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Bio (${f.bio.length}/500)`}>
          <Textarea value={f.bio} maxLength={500} onChange={(e) => set('bio', e.target.value)} />
        </Field>

        {user.companion && (
          <>
            <h3 className="mt-2 font-display text-base font-extrabold">Host profile</h3>
            <Field label={`Headline (${f.headline.length}/90)`}>
              <Input value={f.headline} maxLength={90} onChange={(e) => set('headline', e.target.value)} />
            </Field>
            <Field label={`About (${f.about.length}/1500)`}>
              <Textarea value={f.about} maxLength={1500} onChange={(e) => set('about', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hourly rate (₹199–10,000)">
                <Input type="number" min={199} max={10000} value={f.hourlyRate} onChange={(e) => set('hourlyRate', e.target.value)} />
              </Field>
              <Field label="Host city">
                <Select value={f.hostCity} onChange={(e) => set('hostCity', e.target.value)}>
                  {CITIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={`Activities (${f.categories.length}/5)`}>
              <Chips options={CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))} value={f.categories} max={5} onChange={(v) => set('categories', v)} />
            </Field>
            <Field label={`Languages (${f.languages.length}/6)`}>
              <Chips options={LANGUAGES.map((l) => ({ value: l, label: l }))} value={f.languages} max={6} onChange={(v) => set('languages', v)} />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.womenOnly} onChange={(e) => set('womenOnly', e.target.checked)} /> Women-only meetups (women hosts only)
            </label>
          </>
        )}
        <Field label="Reason for the change (kept in the audit log)">
          <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. User asked support to fix their name" />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * "Log in as user": opens the website in a new tab signed in as this person, with full access — changes are saved and
 * every one is audited; only payments, withdrawals and spending coins stay blocked. 30 minutes. The tab is
 * opened before the request (so pop-up blockers allow it) and given the session in the URL #fragment.
 */
export function ViewAsModal({ user, open, onClose }: { user: U; open: boolean; onClose: () => void }) {
  const { api } = useAdmin();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const first = user.name?.split(' ')[0] ?? 'them';

  const start = async () => {
    const tab = window.open('about:blank', '_blank');
    if (!tab) return toast('Your browser blocked the new tab — allow pop-ups for this site and try again', 'error');
    setBusy(true);
    try {
      const r = await api.admin.impersonate(user.id, reason.trim(), 'full');
      tab.opener = null; // the user's site can't reach back into the admin panel
      const hash = new URLSearchParams({ token: r.token, exp: r.expiresAt, back: `/admin/users/${user.id}`, mode: r.mode ?? 'full' });
      tab.location.replace(`/view-as#${hash}`);
      setReason('');
      onClose();
    } catch (e) {
      tab.close();
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Log in as ${user.name ?? 'this user'}`}
      footer={
        <Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={start}>
          Log in as {first}
        </Button>
      }
    >
      <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">
        <li>Opens the website in a new tab, signed in as {first} with <b>full access</b> — you can do anything they can.</li>
        <li>Every change is saved to the audit log under your name. Messages and reviews you send look to others as if {first} wrote them.</li>
        <li>
          <b>Always blocked:</b> payments, withdrawal requests and spending their coins.
        </li>
        <li>Ends after 30 minutes, when you close the tab or tap “Exit view”. Your own sign-ins aren’t affected.</li>
      </ul>
      <Field label="Reason (kept in the audit log)">
        <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fixing their availability, as they asked" />
      </Field>
    </Modal>
  );
}

/**
 * A message from the team into this member's chat bubble (bottom-right on the website). They see it live if they're on
 * the site (signed in), otherwise the next time they open it — plus a notification that opens the chat. Their reply
 * comes to Admin → Assistant.
 */
export function BubbleMessage({ userId, name }: { userId: string; name: string | null }) {
  const { api } = useAdmin();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const first = name?.split(' ')[0] ?? 'them';
  const send = async () => {
    setBusy(true);
    try {
      const t = await api.admin.messageInBubble(userId, text.trim());
      setSentTo(t.id);
      setText('');
      toast(`Sent to ${first}’s chat bubble`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mt-6 p-5 text-sm">
      <h2 className="font-display text-lg font-extrabold">💬 Message in their chat bubble</h2>
      <p className="mt-1 text-ink-soft">
        Appears in {first}’s chat bubble on the website as you (“Companio team”) — instantly if they’re online, otherwise next time they open the site signed in. They also
        get a notification. Their reply comes to Assistant.
      </p>
      <Textarea
        className="mt-3 min-h-[90px]"
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Hi ${first}! …`}
        aria-label="Chat message"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={text.trim().length < 1} onClick={send}>
          Send to chat bubble
        </Button>
        {sentTo && (
          <a href={`/admin/assistant?chat=${sentTo}`} className="font-semibold underline">
            Open the conversation →
          </a>
        )}
      </div>
    </Card>
  );
}

