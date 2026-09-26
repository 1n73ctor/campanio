'use client';

import { useEffect, useRef, useState } from 'react';
import { WEEKDAYS, type ApplyCompanionInput, type Availability } from '@companio/types';
import { Button, Card, Input } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { FullLoader, PageHeader } from '@/components/misc';
import { CompanionProfileFields, profileValid } from '@/components/profile-form';
import { useToast } from '@/components/toast';
import { errMsg } from '@/lib/format';

const DAY: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export default function CompanionProfilePage() {
  const user = useRequireAuth({ companion: true });
  const { api, refresh } = useAuth();
  const toast = useToast();
  const [v, setV] = useState<ApplyCompanionInput | null>(null);
  const [avail, setAvail] = useState<Availability>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = user?.companion;
    if (!c || v) return;
    setV({ headline: c.headline, about: c.about, hourlyRate: c.hourlyRate, categories: c.categories, languages: c.languages, city: c.city });
    setAvail(c.availability);
    setPhotos(c.photos);
  }, [user, v]);

  if (!user || !v) return <FullLoader />;

  const run = async (name: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(name);
    try {
      await fn();
      await refresh();
      toast(ok);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const setDay = (day: string, slots: { from: string; to: string }[]) => setAvail({ ...avail, [day]: slots });

  return (
    <div className="container-x max-w-3xl space-y-6 pb-10">
      <PageHeader eyebrow="Companion" title="Your profile" />
      <Card className="space-y-5 p-6">
        <CompanionProfileFields value={v} onChange={setV} />
        <Button loading={busy === 'profile'} disabled={!profileValid(v)} onClick={() => run('profile', () => api.companion.updateProfile(v), 'Profile saved')}>
          Save profile
        </Button>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl font-extrabold">Photos</h2>
        <p className="text-sm text-ink-soft">Up to 6. Clear, recent, face visible. No group shots or filters.</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {photos.map((p, i) => (
            <div key={p} className="relative">
              <img src={p} alt="" className="aspect-square w-full rounded-chunky border-3 border-ink object-cover" />
              <button
                aria-label="Remove photo"
                className="absolute -right-2 -top-2 h-7 w-7 rounded-full border-2 border-ink bg-white font-bold"
                onClick={() => run('photo', async () => setPhotos((await api.companion.removePhoto(i)).photos), 'Photo removed')}
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < 6 && (
            <button onClick={() => fileRef.current?.click()} className="flex aspect-square items-center justify-center rounded-chunky border-3 border-dashed border-ink/50 text-3xl">
              +
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) run('photo', async () => setPhotos((await api.companion.addPhoto(f)).photos), 'Photo added');
            e.target.value = '';
          }}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl font-extrabold">Weekly availability (IST)</h2>
        <div className="space-y-3">
          {WEEKDAYS.map((d) => {
            const slots = avail[d] ?? [];
            return (
              <div key={d} className="flex flex-wrap items-center gap-2 border-b-2 border-dashed border-ink/10 pb-3">
                <span className="w-28 font-bold">{DAY[d]}</span>
                {slots.length === 0 && <span className="text-sm text-ink-mute">Unavailable</span>}
                {slots.map((s, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <Input type="time" step={1800} value={s.from} onChange={(e) => setDay(d, slots.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} className="h-9 w-28" />
                    –
                    <Input type="time" step={1800} value={s.to} onChange={(e) => setDay(d, slots.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} className="h-9 w-28" />
                    <button aria-label="Remove slot" className="px-1 font-bold" onClick={() => setDay(d, slots.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </span>
                ))}
                {slots.length < 4 && (
                  <Button size="sm" variant="white" onClick={() => setDay(d, [...slots, { from: '10:00', to: '18:00' }])}>
                    + slot
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <Button loading={busy === 'avail'} onClick={() => run('avail', () => api.companion.setAvailability(avail), 'Availability saved')}>
          Save availability
        </Button>
      </Card>
    </div>
  );
}
