'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { NotificationDto } from '@companio/types';
import { Button, Card, EmptyState, cn } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { FullLoader, PageHeader } from '@/components/misc';
import { fmtTime, timeAgo } from '@/lib/format';
import { NOTIFICATIONS_CHANGED } from '@/components/header';

/** Icon + colour per notification family (type is e.g. "booking.accepted", "payout.paid", "sos"). */
function kindOf(type: string): { icon: string; bg: string } {
  if (/refund|paid_out|goodwill/.test(type) || /^(payment|payout|wallet)/.test(type)) return { icon: '💸', bg: 'bg-lime' };
  if (/^(sos|safety|dispute|report)/.test(type) || type === 'booking.disputed') return { icon: '🛡️', bg: 'bg-pink' };
  if (/^(kyc|companion)/.test(type)) return { icon: '🪪', bg: 'bg-lavender' };
  if (/^review/.test(type)) return { icon: '⭐', bg: 'bg-sunny' };
  if (/^message/.test(type)) return { icon: '💬', bg: 'bg-sky' };
  if (/^promo/.test(type)) return { icon: '🎁', bg: 'bg-tangerine' };
  if (/^booking/.test(type)) return { icon: '📅', bg: 'bg-sky' };
  return { icon: '🔔', bg: 'bg-white' };
}

function groupByDay(items: NotificationDto[]) {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = day(new Date());
  const groups: { label: string; items: NotificationDto[] }[] = [];
  for (const n of items) {
    const diff = Math.round((today - day(new Date(n.createdAt))) / 86_400_000);
    const label = diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier';
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}

export default function NotificationsPage() {
  const user = useRequireAuth();
  const { api } = useAuth();
  const [items, setItems] = useState<NotificationDto[] | null>(null);

  useEffect(() => {
    if (user) api.notifications.list().then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [user, api]);
  useRealtime({ notification: (n: NotificationDto) => setItems((x) => [n, ...(x ?? [])]) });

  if (!user || !items) return <FullLoader />;

  const unread = items.filter((n) => !n.readAt).length;
  const now = () => new Date().toISOString();
  // tell the header to refresh its badge once the server has the change
  const synced = (p: Promise<unknown>) => p.then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))).catch(() => {});

  const markRead = (n: NotificationDto) => {
    if (n.readAt) return;
    setItems((x) => x?.map((y) => (y.id === n.id ? { ...y, readAt: now() } : y)) ?? x);
    synced(api.notifications.read(n.id));
  };
  const markAll = () => {
    setItems(items.map((n) => ({ ...n, readAt: n.readAt ?? now() })));
    synced(api.notifications.readAll());
  };

  return (
    <div className="container-x max-w-2xl pb-12">
      <PageHeader
        title="Notifications"
        subtitle={items.length > 0 && (unread ? `${unread} unread` : 'You’re all caught up')}
        actions={
          unread > 0 && (
            <Button size="sm" variant="white" onClick={markAll}>
              ✓ Mark all read
            </Button>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState emoji="🔔" title="All caught up" body="Booking updates, payments and safety alerts will show up here." />
      ) : (
        <div className="space-y-7">
          {groupByDay(items).map((g) => (
            <section key={g.label}>
              <h2 className="mb-2.5 px-1 text-xs font-extrabold uppercase tracking-[0.15em] text-ink-mute">{g.label}</h2>
              <Card className="overflow-hidden p-0">
                <ul className="divide-y-2 divide-ink/10">
                  {g.items.map((n) => (
                    <li key={n.id}>
                      <Row n={n} when={g.label === 'Yesterday' ? fmtTime(n.createdAt) : timeAgo(n.createdAt)} onRead={() => markRead(n)} />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** `when`: relative for today ("8m ago"), clock time under Yesterday — "3h ago" there would read as a contradiction just after midnight. */
function Row({ n, when, onRead }: { n: NotificationDto; when: string; onRead: () => void }) {
  const kind = kindOf(n.type);
  const unread = !n.readAt;
  const content = (
    <>
      <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink text-lg', kind.bg)}>
        {kind.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block font-display leading-snug', unread ? 'font-extrabold' : 'font-bold')}>{n.title}</span>
        <span className="mt-0.5 block text-sm text-ink-soft">{n.body}</span>
        <span className="mt-1 block text-xs text-ink-mute">{when}</span>
      </span>
      {unread && <span className="mt-2 h-3 w-3 shrink-0 rounded-full border-2 border-ink bg-pink" aria-label="Unread" />}
    </>
  );
  const cls = cn('flex w-full items-start gap-3.5 px-4 py-4 text-left transition-colors sm:px-5', unread ? 'bg-sunny-soft hover:bg-sunny/40' : 'hover:bg-paper-deep');
  return n.link ? (
    <Link href={n.link} onClick={onRead} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onRead} className={cn(cls, !unread && 'cursor-default')}>
      {content}
    </button>
  );
}
