'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GENDERS, MIN_AGE, ageFromDob, humanize, type Gender } from '@companio/types';
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader } from '@/components/misc';
import { CityPicker } from '@/components/city-picker';
import { errMsg } from '@/lib/format';

function OnboardingInner() {
  const user = useRequireAuth({ allowUnonboarded: true });
  const { api, setUser } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next') || '/explore';
  const [form, setForm] = useState({ name: '', dob: '', gender: '' as Gender | '', city: '', bio: '' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.onboarded) router.replace(next);
    setForm({ name: user.name ?? '', dob: user.dob?.slice(0, 10) ?? '', gender: user.gender ?? '', city: user.city ?? '', bio: user.bio ?? '' });
  }, [user, router, next]);

  if (!user) return <FullLoader />;
  const age = ageFromDob(form.dob);
  const tooYoung = form.dob && (age === null || age < MIN_AGE);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const u = await api.me.update({ name: form.name.trim(), dob: form.dob, gender: form.gender || undefined, city: form.city, bio: form.bio || undefined, acceptGuidelines: agree });
      setUser(u);
      router.replace(next);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="container-x max-w-xl py-10">
      <h1 className="text-3xl font-extrabold">Let’s set you up ✨</h1>
      <p className="mt-1 text-ink-soft">This takes 30 seconds. Companions see your first name and city only.</p>
      <Card className="mt-6 space-y-4 p-6">
        <Field label="First & last name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" error={tooYoung ? `You must be ${MIN_AGE}+ to use Companio` : null} hint="Can’t be changed later">
            <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} max={new Date().toISOString().slice(0, 10)} required />
          </Field>
          <Field label="Gender (optional)">
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}>
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
          <CityPicker value={form.city} onChange={(city) => setForm({ ...form, city })} placeholder="Search your city…" required />
        </Field>
        <Field label="A line about you (optional)">
          <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={500} placeholder="New in town, love street food and indie music…" />
        </Field>
        <div className="rounded-chunky border-3 border-ink bg-sunny-soft p-4">
          <Checkbox
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            label={
              <>
                <b>I’m 18+ and I’ll keep it platonic.</b> Companio is for friendship and activities only. Sexual or romantic solicitation, harassment or off-platform payments get accounts banned.
              </>
            }
          />
        </div>
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        <Button size="lg" className="w-full" loading={busy} disabled={!form.name.trim() || !form.dob || !!tooYoung || !form.city || !agree} onClick={submit}>
          Let’s go →
        </Button>
      </Card>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  );
}
