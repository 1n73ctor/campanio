'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BookingDto } from '@companio/types';
import { EmptyState, Spinner, Tabs, buttonClass } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { FullLoader, PageHeader } from '@/components/misc';
import { BookingRow } from '@/components/booking-row';

export default function BookingsPage() {
  const user = useRequireAuth();
  const { api } = useAuth();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [as, setAs] = useState<'user' | 'companion'>('user');
  const [items, setItems] = useState<BookingDto[] | null>(null);

  const load = () => api.bookings.list({ scope, as }).then(setItems).catch(() => setItems([]));
  useEffect(() => {
    if (!user) return;
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, scope, as]);
  useRealtime({ 'booking:update': () => load() });

  if (!user) return <FullLoader />;
  return (
    <div className="container-x max-w-3xl pb-10">
      <PageHeader title="Your bookings" />
      <div className="mb-6 flex flex-wrap gap-3">
        <Tabs value={scope} onChange={setScope} items={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} />
        {user.companion && <Tabs value={as} onChange={setAs} items={[{ value: 'user', label: 'I booked' }, { value: 'companion', label: 'Booked me' }]} />}
      </div>
      {!items ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          emoji={scope === 'upcoming' ? '📅' : '🗂️'}
          title={scope === 'upcoming' ? 'Nothing planned yet' : 'No past bookings'}
          body="Find someone to hang out with — gym, movies, a city walk, anything."
          action={
            <Link href="/explore" className={buttonClass('primary')}>
              Explore companions
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((b) => (
            <BookingRow key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}
