'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CATEGORIES } from '@companio/types';
import { Button, Select } from '@companio/ui';
import { CityPicker } from '@/components/city-picker';

export function SearchBar({ defaultCategory = '', defaultCity = '' }: { defaultCategory?: string; defaultCity?: string }) {
  const router = useRouter();
  const [cat, setCat] = useState(defaultCategory);
  const [city, setCity] = useState(defaultCity);
  const go = () => {
    if (cat && city) router.push(`/explore/${cat}/${city}`);
    else if (cat) router.push(`/explore/${cat}`);
    else router.push(`/explore${city ? `?city=${city}` : ''}`);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="flex flex-col gap-2 rounded-blob border-3 border-ink bg-white p-2 shadow-brutal-lg sm:flex-row"
    >
      <Select aria-label="Activity" value={cat} onChange={(e) => setCat(e.target.value)} className="border-0 sm:flex-1">
        <option value="">Any activity</option>
        {CATEGORIES.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.emoji} {c.name}
          </option>
        ))}
      </Select>
      <div className="hidden w-[3px] bg-ink/10 sm:block" />
      <CityPicker aria-label="City" value={city} onChange={setCity} anyLabel="Any city" className="sm:flex-1" />
      <Button type="submit" size="md" className="sm:w-40">
        Find company →
      </Button>
    </form>
  );
}
