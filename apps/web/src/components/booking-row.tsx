import Link from 'next/link';
import { BOOKING_STATUS_LABEL, CATEGORIES, formatINR, type BookingDto } from '@companio/types';
import { Avatar, Card, StatusBadge } from '@companio/ui';
import { fmtDateTime } from '@/lib/format';

export function BookingRow({ b }: { b: BookingDto }) {
  const other = b.viewerRole === 'companion' ? b.user : b.companion;
  const cat = CATEGORIES.find((c) => c.slug === b.category);
  return (
    <Link href={b.status === 'PENDING_PAYMENT' && b.viewerRole === 'user' ? `/checkout/${b.id}` : `/bookings/${b.id}`}>
      <Card interactive className="flex items-center gap-4 p-4">
        <Avatar name={other.name} src={other.avatarUrl} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-extrabold">
            {cat?.emoji} {cat?.name} · {other.name?.split(' ')[0]}
          </p>
          <p className="truncate text-sm text-ink-soft">
            {fmtDateTime(b.startAt)} · {b.hours}h · {b.meetingPoint}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
          <span className="text-sm font-bold tabular-nums">{formatINR(b.viewerRole === 'companion' ? b.companionPayout : b.total)}</span>
        </div>
      </Card>
    </Link>
  );
}
