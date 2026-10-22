'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { AdminAssistantKnowledge } from '@companio/api-client';
import { Button, Callout, Card, Field, Input, Modal, Select, Stat, Textarea, Toggle, cn } from '@companio/ui';
import { ErrorBox, Loading, PageTitle, Pager, Table, Td } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, useAdmin, useLoad } from '@/admin/lib/api';
import { dtIST } from '@/admin/lib/format';
import { useAdminRealtime } from '@/admin/lib/realtime';

/** The AI assistant ("Riya"): switch it on, reply to people who asked for the team, read its chats, and teach it answers. */
export default function AssistantAdminPage() {
  const { api } = useAdmin();
  const toast = useToast();
  const { data: stats, reload: reloadStats } = useLoad(() => api.admin.assistantStats(), []);
  const { data: settings, reload: reloadSettings } = useLoad(() => api.admin.settings(), []);
  const [tab, setTab] = useState<'chats' | 'knowledge'>('chats');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { data: chats, error, reload: reloadChats } = useLoad(() => api.admin.assistantConversations({ page, filter }), [page, filter]);
  const [tick, setTick] = useState(0);
  const { data: knowledge, reload: reloadKnowledge } = useLoad(() => api.admin.assistantKnowledge(), []);
  const [openChat, setOpenChat] = useState<string | null>(null);

  // the admin alert email links here with ?chat=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('chat');
    if (id) setOpenChat(id);
  }, []);

  // live: new requests and messages show up without reloading the page
  useAdminRealtime({
    'assistant:waiting': () => (reloadChats(), reloadStats(), setTick((n) => n + 1)),
    'assistant:message': () => (reloadChats(), reloadStats(), setTick((n) => n + 1)),
  });
  const [editing, setEditing] = useState<Partial<AdminAssistantKnowledge> | null>(null);
  const [busy, setBusy] = useState(false);

  const enabled = settings?.assistantEnabled === 1;
  const toggle = async (v: boolean) => {
    try {
      await api.admin.updateSettings({ assistantEnabled: v ? 1 : 0 });
      reloadSettings();
      toast(v ? 'Assistant is on' : 'Assistant is off');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const saveKnowledge = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api.admin.saveAssistantKnowledge({ id: editing.id, question: editing.question ?? '', answer: editing.answer ?? '', active: editing.active ?? true });
      toast('Saved — the assistant uses it from the next message');
      setEditing(null);
      reloadKnowledge();
      reloadStats();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="🤖 Assistant" subtitle="Riya, the AI that answers in the chat bubble. Reply to people who ask for the team, read her chats and teach her answers you approve." />
      <Card tone={enabled && stats?.configured ? 'lime' : 'white'} className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-display text-lg font-extrabold">{enabled && stats?.configured ? 'On — answering visitors' : 'Off'}</p>
          <p className="text-sm text-ink-soft">
            {stats && !stats.configured
              ? 'Add ANTHROPIC_API_KEY to the API’s .env first (console.anthropic.com → API keys).'
              : 'When it’s on, it answers in the chat bubble. “Talk to a person” sends the chat to you here — reply and it appears in their chat window.'}
            {stats?.configured && <span className="block text-xs">Model: {stats.model}</span>}
          </p>
        </div>
        <Toggle checked={enabled} disabled={!settings || !stats?.configured} onChange={toggle} label="Assistant on" />
      </Card>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Chats (7 days)" value={stats.last7Days.conversations} />
          <Stat label="Needed a person" value={stats.last7Days.handoffs} tone={stats.last7Days.handoffs ? 'sunny' : 'white'} />
          <Stat label="👍 Helpful" value={stats.last7Days.liked} tone="lime" />
          <Stat label="👎 Not helpful" value={stats.last7Days.disliked} tone={stats.last7Days.disliked ? 'pink' : 'white'} />
          <Stat label="Approved answers" value={stats.knowledge} tone="sky" />
        </div>
      )}
      {stats && (
        <Card className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-2 p-4 text-sm">
          <span>
            <b>Cost, last 7 days:</b> ≈ ${stats.last7Days.costUsd.toFixed(2)} <span className="text-ink-mute">(≈ ₹{Math.round(stats.last7Days.costUsd * 88)})</span>
          </span>
          <span>
            <b>{stats.last7Days.freeReplies}</b> free instant answers · <b>{stats.last7Days.aiReplies}</b> AI replies
            {stats.last7Days.aiReplies + stats.last7Days.freeReplies > 0 && (
              <span className="text-ink-mute"> ({Math.round((stats.last7Days.freeReplies / (stats.last7Days.aiReplies + stats.last7Days.freeReplies)) * 100)}% free)</span>
            )}
          </span>
          <span className="text-xs text-ink-mute">Every answer you approve can be served free next time. Estimate at {stats.model} list prices.</span>
        </Card>
      )}

      {!!stats?.waiting && (
        <Card tone="pink" className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="font-display font-extrabold">🙋 {stats.waiting} {stats.waiting === 1 ? 'person is' : 'people are'} waiting for a reply from the team</p>
          <Button size="sm" onClick={() => (setTab('chats'), setFilter('waiting'), setPage(1))}>Show them</Button>
        </Card>
      )}

      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={tab === 'chats' ? 'primary' : 'white'} onClick={() => setTab('chats')}>Conversations</Button>
        <Button size="sm" variant={tab === 'knowledge' ? 'primary' : 'white'} onClick={() => setTab('knowledge')}>Knowledge ({knowledge?.length ?? 0})</Button>
      </div>

      {tab === 'chats' ? (
        <>
          <Select value={filter} onChange={(e) => (setFilter(e.target.value), setPage(1))} className="mb-4 max-w-64" aria-label="Show">
            <option value="all">All conversations</option>
            <option value="waiting">🙋 Waiting for a reply</option>
            <option value="team">💬 With the team (open)</option>
            <option value="handoff">Needed a person</option>
            <option value="disliked">👎 Not helpful</option>
            <option value="liked">👍 Helpful</option>
          </Select>
          {error ? (
            <ErrorBox error={error} />
          ) : !chats ? (
            <Loading />
          ) : (
            <>
              <Table head={['Last message (IST)', 'Who', 'First question', 'Msgs', '']} empty={chats.items.length === 0}>
                {chats.items.map((c) => (
                  <tr key={c.id}>
                    <Td className="whitespace-nowrap text-xs">{dtIST(c.lastAt)}</Td>
                    <Td>{c.user ? <Link href={`/admin/users/${c.user.id}`} className="underline">{c.user.name ?? 'Member'}</Link> : <span className="text-ink-mute">Visitor</span>}</Td>
                    <Td className="max-w-md text-sm">
                      <span className="line-clamp-2">{c.firstQuestion}</span>
                      <span className="mt-1 flex gap-1 text-xs">
                        {c.human === 'waiting' ? (
                          <span className="animate-pulse rounded-full bg-danger px-2 font-bold text-white">🙋 waiting for your reply</span>
                        ) : c.human === 'answered' ? (
                          <span className="rounded-full bg-sky px-2">💬 with the team</span>
                        ) : (
                          c.handoff && <span className="rounded-full bg-sunny px-2">🙋 needed a person</span>
                        )}
                        {c.rating === 1 && <span className="rounded-full bg-lime px-2">👍</span>}
                        {c.rating === -1 && <span className="rounded-full bg-pink px-2">👎</span>}
                      </span>
                    </Td>
                    <Td className="tabular-nums">{c.messages}</Td>
                    <Td>
                      <Button size="sm" variant={c.human === 'waiting' ? 'primary' : 'white'} onClick={() => setOpenChat(c.id)}>
                        {c.human === 'waiting' ? 'Reply' : 'Read'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Table>
              <Pager page={chats.page} total={chats.total} pageSize={chats.pageSize} onPage={setPage} />
            </>
          )}
        </>
      ) : (
        <>
          <Callout tone="sky" className="mb-4">
            These are the answers Riya trusts most — they override her general knowledge. Add one whenever she got something wrong or had to pass a question to you.
          </Callout>
          <Button className="mb-4" onClick={() => setEditing({ question: '', answer: '', active: true })}>+ Add an answer</Button>
          {!knowledge ? (
            <Loading />
          ) : (
            <div className="space-y-3">
              {knowledge.length === 0 && <p className="text-sm text-ink-mute">No answers yet.</p>}
              {knowledge.map((k) => (
                <Card key={k.id} className={cn('p-4 text-sm', !k.active && 'opacity-60')}>
                  <p className="font-bold">Q: {k.question}</p>
                  <p className="mt-1 whitespace-pre-wrap">A: {k.answer}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="white" onClick={() => setEditing(k)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="white"
                      onClick={async () => {
                        await api.admin.saveAssistantKnowledge({ id: k.id, question: k.question, answer: k.answer, active: !k.active });
                        reloadKnowledge();
                      }}
                    >
                      {k.active ? 'Switch off' : 'Switch on'}
                    </Button>
                    <Button
                      size="sm"
                      variant="white"
                      onClick={async () => {
                        if (!confirm('Delete this answer?')) return;
                        await api.admin.deleteAssistantKnowledge(k.id);
                        reloadKnowledge();
                      }}
                    >
                      Delete
                    </Button>
                    <span className="text-xs text-ink-mute">updated {dtIST(k.updatedAt)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {openChat && <Transcript id={openChat} tick={tick} onChanged={() => (reloadChats(), reloadStats())} onClose={() => setOpenChat(null)} onTeach={(q) => (setOpenChat(null), setTab('knowledge'), setEditing({ question: q, answer: '', active: true }))} />}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit answer' : 'Teach Riya an answer'}
        footer={
          <Button loading={busy} disabled={(editing?.question?.trim().length ?? 0) < 3 || (editing?.answer?.trim().length ?? 0) < 3} onClick={saveKnowledge}>
            Save answer
          </Button>
        }
      >
        {editing && (
          <div className="space-y-3">
            <Field label="When someone asks…">
              <Input value={editing.question ?? ''} maxLength={300} onChange={(e) => setEditing({ ...editing, question: e.target.value })} placeholder="Can I bring a friend to a meetup?" />
            </Field>
            <Field label="Riya should answer (in your words)">
              <Textarea value={editing.answer ?? ''} maxLength={2000} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} placeholder="Yes, if the host agrees first — ask them in chat before booking." />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

function Transcript({ id, tick, onChanged, onClose, onTeach }: { id: string; tick: number; onChanged: () => void; onClose: () => void; onTeach: (question: string) => void }) {
  const { api } = useAdmin();
  const toast = useToast();
  const { data, reload } = useLoad(() => api.admin.assistantConversation(id), [id]);
  const [c, setC] = useState(data);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setC(data);
  }, [data]);
  // a new message in any chat: refresh this one (cheap, and it may be this one)
  useEffect(() => {
    if (tick) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [c?.messages.length]);

  const live = c?.human === 'waiting' || c?.human === 'answered';
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      setC(await api.admin.replyAssistant(id, t));
      setText('');
      onChanged();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const close = async () => {
    setBusy(true);
    try {
      setC(await api.admin.closeAssistant(id));
      toast('Chat closed — Riya answers them from here');
      onChanged();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={c?.user?.name ? `Chat with ${c.user.name}` : 'Chat with a visitor'}
      footer={
        c && (
          <div className="w-full space-y-2">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <Textarea
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={live ? 'Reply… (Enter sends, Shift+Enter for a new line)' : 'Write to them — they’ll see it in their chat window'}
                className="min-h-[70px] flex-1"
                aria-label="Your reply"
              />
              <Button type="submit" loading={busy} disabled={!text.trim()}>Send</Button>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-mute">
              <span>{c.user ? 'Signed-in member' : 'Visitor (not signed in)'} · they see your first name and “Companio team”. Their window checks for replies every few seconds while open.</span>
              {live && (
                <Button size="sm" variant="white" disabled={busy} onClick={close}>
                  ✓ Close chat (back to Riya)
                </Button>
              )}
            </div>
          </div>
        )
      }
    >
      {!c ? (
        <Loading />
      ) : (
        <div className="max-h-[55vh] space-y-2 overflow-y-auto text-sm">
          {c.summary && <Callout tone="sunny">🙋 Passed to a person: {c.summary}</Callout>}
          {c.messages.map((m) =>
            m.role === 'note' ? (
              <p key={m.id} className="text-center text-xs font-semibold text-ink-soft">
                {m.content} · {dtIST(m.at)}
              </p>
            ) : (
              <div
                key={m.id}
                className={cn('rounded-xl border-2 p-2', m.role === 'user' ? 'mr-6 border-ink bg-pink-soft' : m.role === 'agent' ? 'ml-6 border-ink bg-lime-soft' : 'ml-6 border-ink/20 bg-white')}
              >
                <p className="text-xs text-ink-mute">
                  {m.role === 'user' ? (c.user?.name ?? 'Visitor') : m.role === 'agent' ? `${m.name ?? 'Team'} (team)` : 'Riya (AI)'} · {dtIST(m.at)}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.role === 'user' && (
                  <button type="button" onClick={() => onTeach(m.content)} className="mt-1 text-xs font-bold underline">
                    ✨ Teach Riya the answer to this
                  </button>
                )}
              </div>
            ),
          )}
          {c.human === 'waiting' && <p className="text-center text-xs font-bold text-danger">Waiting for your reply</p>}
          <div ref={endRef} />
        </div>
      )}
    </Modal>
  );
}
