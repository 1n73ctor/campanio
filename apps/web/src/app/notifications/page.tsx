'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { NotificationDto } from '@companio/types';
import { Button, Card, EmptyState, cn } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { FullLoader, PageHeader } from '@/components/misc';
import { timeAgo } from '@/lib/format';

export default function NotificationsPage() {
  const user = useRequireAuth();
  const { api } = useAuth();
  const [items, setItems] = useState<NotificationDto[] | null>(null);

  useEffect(() => {
    if (user) api.notifications.list().then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [user, api]);
  useRealtime({ notification: (n: NotificationDto) => setItems((x) => [n, ...(x ?? [])]) });

  if (!user || !items) return <FullLoader />;
  return (
    <div className="container-x max-w-2xl pb-10">
      <PageHeader
        title="Notifications"
        actions={
          items.some((n) => !n.readAt) && (
            <Button
              size="sm"
              variant="white"
              onClick={async () => {
                await api.notifications.readAll();
                setItems(items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
              }}
            >
              Mark all read
            </Button>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState emoji="🔔" title="All caught up" />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const body = (
              <Card interactive={!!n.link} tone={n.readAt ? 'white' : 'sunny'} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className={cn('font-display font-bold', !n.readAt && 'font-extrabold')}>{n.title}</p>
                  <span className="shrink-0 text-xs text-ink-mute">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>
              </Card>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} onClick={() => !n.readAt && api.notifications.read(n.id)}>
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
