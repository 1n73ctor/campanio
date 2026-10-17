'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ConversationDto } from '@companio/types';
import { Avatar, Card, EmptyState, cn } from '@companio/ui';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { FullLoader, PageHeader } from '@/components/misc';
import { timeAgo } from '@/lib/format';

export default function MessagesPage() {
  const user = useRequireAuth();
  const { api } = useAuth();
  const [list, setList] = useState<ConversationDto[] | null>(null);
  const load = () => api.chats.list().then(setList).catch(() => setList([]));
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  useRealtime({ 'dm:new': () => load() });

  if (!user || !list) return <FullLoader />;
  return (
    <div className="container-x max-w-2xl pb-10">
      <PageHeader title="Messages" subtitle={user.companion ? 'Chats members opened with you — replies are free.' : 'Your chats with hosts.'} />
      {list.length === 0 ? (
        <EmptyState title="No chats yet" body="Open a host’s profile and tap “Message” to start a chat." />
      ) : (
        <Card className="divide-y-2 divide-dashed divide-ink/10 p-0">
          {list.map((c) => (
            <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-paper">
              <Avatar name={c.other.name} src={c.other.avatarUrl} size={48} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={cn('truncate', c.unread ? 'font-extrabold' : 'font-bold')}>{c.other.name ?? 'Someone'}</span>
                  {c.lastMessage && <span className="shrink-0 text-xs text-ink-mute">{timeAgo(c.lastMessage.createdAt)}</span>}
                </span>
                <span className={cn('block truncate text-sm', c.unread ? 'font-semibold text-ink' : 'text-ink-soft')}>
                  {c.lastMessage ? `${c.lastMessage.senderId === user.id ? 'You: ' : ''}${c.lastMessage.body}` : 'Chat open — say hi 👋'}
                </span>
                <span className="mt-0.5 block text-xs text-ink-mute">
                  {c.viewerRole === 'host'
                    ? c.hostReplied
                      ? 'Member chat'
                      : c.earnOnReply > 0
                        ? `⏳ Reply to earn ${c.earnOnReply} coins`
                        : '⏳ Waiting for your reply'
                    : c.permanent
                      ? 'Open for good'
                      : c.canWrite
                        ? 'Open now'
                        : 'Chat time over'}
                </span>
              </span>
              {c.unread && <span className="h-3 w-3 shrink-0 rounded-full border-2 border-ink bg-pink" aria-label="Unread" />}
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
