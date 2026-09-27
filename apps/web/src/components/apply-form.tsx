'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ApplyCompanionInput } from '@companio/types';
import { Button, Card, Checkbox, buttonClass } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { track } from '@/lib/analytics';
import { CompanionProfileFields, profileValid } from './profile-form';
import { useToast } from './toast';

export function ApplyForm() {
  const { user, ready, api, refresh } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<ApplyCompanionInput>({ headline: '', about: '', hourlyRate: 399, categories: [], languages: [], city: user?.city ?? '' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (!user)
    return (
      <Card tone="sunny" className="p-6 text-center">
        <p className="font-display text-xl font-extrabold">Ready to start?</p>
        <p className="mt-1 text-ink-soft">Sign up with your phone number — it takes a minute.</p>
        <Link href="/login?next=/become-a-companion" className={buttonClass('dark', 'lg', 'mt-4')}>
          Sign up to apply
        </Link>
      </Card>
    );
  if (!user.onboarded)
    return (
      <Card tone="sunny" className="p-6 text-center">
        <Link href="/onboarding?next=/become-a-companion" className={buttonClass('dark', 'lg')}>
          Finish your profile first
        </Link>
      </Card>
    );
  if (user.companion)
    return (
      <Card tone="lime" className="p-6 text-center">
        <p className="font-display text-xl font-extrabold">You’re already a companion 🎉</p>
        <Link href="/companion/dashboard" className={buttonClass('dark', 'lg', 'mt-4')}>
          Go to dashboard
        </Link>
      </Card>
    );

  const submit = async () => {
    setBusy(true);
    try {
      await api.companion.apply({ ...v, hourlyRate: Math.round(v.hourlyRate) });
      track({ name: 'companion_apply' });
      await refresh();
      toast('Profile created! Next: verify your ID');
      router.push('/companion/kyc');
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-5 p-6">
      <h2 className="text-2xl font-extrabold">Create your companion profile</h2>
      <CompanionProfileFields value={v} onChange={setV} />
      <div className="rounded-chunky border-3 border-ink bg-sunny-soft p-4">
        <Checkbox
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label={<>I’ll keep every booking <b>platonic and in public places</b>, never ask for off-platform payment, and follow the community guidelines.</>}
        />
      </div>
      <Button size="lg" className="w-full" loading={busy} disabled={!profileValid(v) || !agree} onClick={submit}>
        Create profile → verify ID
      </Button>
    </Card>
  );
}
