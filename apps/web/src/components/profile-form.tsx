'use client';

import { CATEGORIES, CITIES, LANGUAGES, type ApplyCompanionInput } from '@companio/types';
import { Chip, Field, Input, Select, Textarea } from '@companio/ui';

export function CompanionProfileFields({ value, onChange }: { value: ApplyCompanionInput; onChange: (v: ApplyCompanionInput) => void }) {
  const toggle = (key: 'categories' | 'languages', item: string, max: number) => {
    const has = value[key].includes(item);
    const next = has ? value[key].filter((x) => x !== item) : value[key].length < max ? [...value[key], item] : value[key];
    onChange({ ...value, [key]: next });
  };
  return (
    <div className="space-y-5">
      <Field label="Headline" hint={`${value.headline.length}/90 · one line that sums up your vibe`}>
        <Input value={value.headline} onChange={(e) => onChange({ ...value, headline: e.target.value })} maxLength={90} placeholder="Born-and-raised local who knows every hidden café" />
      </Field>
      <Field label="About you" hint={`${value.about.length}/1500 · min 40 characters. What do you love doing? What’s a session with you like?`}>
        <Textarea value={value.about} onChange={(e) => onChange({ ...value, about: e.target.value })} maxLength={1500} className="min-h-[140px]" />
      </Field>
      <Field label="Activities (up to 5)">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c.slug} active={value.categories.includes(c.slug)} onClick={() => toggle('categories', c.slug, 5)}>
              {c.emoji} {c.name}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Languages (up to 6)">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l} active={value.languages.includes(l)} onClick={() => toggle('languages', l, 6)}>
              {l}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City">
          <Select value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })}>
            <option value="">Choose</option>
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hourly rate (₹)" hint="₹199 – ₹10,000. You keep 85%.">
          <Input type="number" min={199} max={10000} step={50} value={value.hourlyRate} onChange={(e) => onChange({ ...value, hourlyRate: Number(e.target.value) })} />
        </Field>
      </div>
    </div>
  );
}

export const profileValid = (v: ApplyCompanionInput) =>
  v.headline.trim().length >= 8 && v.about.trim().length >= 40 && v.categories.length > 0 && v.languages.length > 0 && !!v.city && v.hourlyRate >= 199 && v.hourlyRate <= 10000;
