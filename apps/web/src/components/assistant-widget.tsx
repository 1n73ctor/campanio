'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { CONSENT_CHANGED, TRACKING_ENABLED, getConsent } from '@/lib/analytics';
import { ASSISTANT_CHANGED, openHumanChat } from './live-chat';

type Msg = { role: 'user' | 'assistant' | 'note'; content: string };
const KEY = 'companio.assistant.key';
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
const save = (k?: string) => {
  try {
    if (k) localStorage.setItem(KEY, k);
    else localStorage.removeItem(KEY);
  } catch {}
};

/** light formatting for replies: **bold** and "- " bullets, everything else as plain text */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const bullet = /^\s*[-•*]\s+/.test(line);
        const parts = line.replace(/^\s*[-•*]\s+/, '').split(/\*\*(.+?)\*\*/g);
        const body = parts.map((p, j) => (j % 2 ? <b key={j}>{p}</b> : <span key={j}>{p}</span>));
        return bullet ? (
          <div key={i} className="flex gap-1.5 pl-1">
            <span>•</span>
            <span>{body}</span>
          </div>
        ) : (
          <div key={i} className={line.trim() ? '' : 'h-2'}>
            {body}
          </div>
        );
      })}
    </>
  );
}

/**
 * "Riya", Companio's AI assistant: a chat bubble on every page. Signed-in people get answers about their own account
 * (read-only); "Talk to a person" hands the conversation to the team on Tawk.to with a summary.
 */
export function AssistantWidget() {
  const { api, user, ready, viewAs } = useAuth();
  const path = usePathname();
  const [on, setOn] = useState(false);
  const [name, setName] = useState('Riya');
  const [open, setOpen] = useState(false);
  const [hiddenForCookies, setHiddenForCookies] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rated, setRated] = useState<1 | -1 | null>(null);
  const [key, setKey] = useState<string | undefined>(undefined);
  const endRef = useRef<HTMLDivElement>(null);

  // switched on from Admin → Assistant (and only once the server has an AI key)
  useEffect(() => {
    if (!ready || viewAs) return;
    api.assistant
      .status()
      .then((s) => {
        setOn(s.enabled);
        setName(s.name);
        document.documentElement.dataset.assistant = s.enabled ? 'on' : 'off';
        window.dispatchEvent(new Event(ASSISTANT_CHANGED));
      })
      .catch(() => {});
  }, [api, ready, viewAs]);

  // like the Tawk bubble: wait until the cookie banner has been answered (it would cover it on phones)
  useEffect(() => {
    const sync = () => setHiddenForCookies(TRACKING_ENABLED && getConsent() === null);
    sync();
    window.addEventListener(CONSENT_CHANGED, sync);
    return () => window.removeEventListener(CONSENT_CHANGED, sync);
  }, []);

  // restore the conversation when the window is first opened
  useEffect(() => {
    if (!open || msgs.length) return;
    const k = read();
    setKey(k);
    if (!k) return;
    api.assistant
      .history(k)
      .then((h) => {
        setMsgs(h.messages.map((m) => ({ role: m.role, content: m.content })));
        setRated((h.rating as 1 | -1 | null) ?? null);
      })
      .catch(() => save(undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length, busy, open]);

  if (!on || viewAs || hiddenForCookies || path?.startsWith('/view-as')) return null;

  const send = async (message: string) => {
    const m = message.trim();
    if (!m || busy) return;
    setText('');
    setMsgs((x) => [...x, { role: 'user', content: m }]);
    setBusy(true);
    try {
      const r = await api.assistant.chat(m, key);
      setKey(r.conversationKey);
      save(r.conversationKey);
      setMsgs((x) => [...x, { role: 'assistant', content: r.reply }]);
      if (r.handoff) handOver(r.summary ?? m);
    } catch (e) {
      setMsgs((x) => [...x, { role: 'note', content: errMsg(e) }]);
    } finally {
      setBusy(false);
    }
  };

  const handOver = (summary: string) => {
    if (openHumanChat(summary)) {
      setOpen(false);
      return;
    }
    setMsgs((x) => [...x, { role: 'note', content: 'Our team will get back to you — email info@getcompanio.in and mention this chat.' }]);
  };

  const askHuman = async () => {
    let summary = msgs.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? 'Wants to talk to a person';
    if (key) summary = (await api.assistant.human(key).catch(() => ({ summary }))).summary;
    handOver(summary);
  };

  const rate = async (r: 1 | -1) => {
    if (!key) return;
    setRated(r);
    await api.assistant.rate(key, r).catch(() => {});
  };

  const fresh = () => {
    save(undefined);
    setKey(undefined);
    setMsgs([]);
    setRated(null);
  };

  const starters = user
    ? ['Where’s my refund?', 'How many coins do I have?', 'Is my booking confirmed?', 'How do I become a host?']
    : ['How does booking work?', 'Is it safe?', 'How much does it cost?', 'How do I become a host?'];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Chat with ${name}, Companio’s assistant`}
          className="fixed bottom-24 right-4 z-[55] flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-pink shadow-brutal transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
        >
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="#fff" stroke="#141414" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="9" cy="9.6" r="1.2" fill="#141414" />
            <circle cx="12" cy="9.6" r="1.2" fill="#141414" />
            <circle cx="15" cy="9.6" r="1.2" fill="#141414" />
          </svg>
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-label={`Chat with ${name}`}
          className="fixed inset-0 z-[70] flex flex-col bg-paper sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:max-h-[calc(100vh-48px)] sm:w-[390px] sm:rounded-blob sm:border-3 sm:border-ink sm:shadow-brutal"
        >
          <div className="flex items-center gap-3 border-b-3 border-ink bg-pink px-4 py-3 sm:rounded-t-[1.6rem]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-3 border-ink bg-white text-lg">✨</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold leading-tight">{name}</p>
              <p className="text-xs font-semibold">Companio AI assistant · replies instantly</p>
            </div>
            <button type="button" onClick={fresh} className="rounded-full px-2 text-xs font-bold underline" title="Start a new chat">
              New
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white font-bold">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[15px]">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border-2 border-ink bg-white px-3 py-2">
              Hi{user?.name ? ` ${user.name.split(' ')[0]}` : ''}! 👋 I’m {name}, Companio’s AI assistant. Ask me anything about meetups, safety, hosting or your account — or tap “Talk to a person”.
            </div>
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border-2 border-ink bg-sunny-soft px-3 py-1.5 text-sm font-semibold hover:bg-sunny">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === 'note' ? (
                <p key={i} className="text-center text-xs font-semibold text-ink-soft">
                  {m.content}
                </p>
              ) : (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl border-2 border-ink px-3 py-2', m.role === 'user' ? 'rounded-tr-sm bg-pink-soft' : 'rounded-tl-sm bg-white')}>
                    {m.role === 'assistant' ? <Rich text={m.content} /> : m.content}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex">
                <div className="flex gap-1 rounded-2xl rounded-tl-sm border-2 border-ink bg-white px-3 py-3" aria-label={`${name} is typing`}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-ink" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {key && msgs.some((m) => m.role === 'assistant') && !busy && (
              <div className="flex items-center justify-center gap-2 text-xs text-ink-soft">
                {rated ? (
                  'Thanks for the feedback!'
                ) : (
                  <>
                    Was this helpful?
                    <button type="button" onClick={() => rate(1)} className="rounded-full border-2 border-ink bg-white px-2 py-0.5" aria-label="Helpful">
                      👍
                    </button>
                    <button type="button" onClick={() => rate(-1)} className="rounded-full border-2 border-ink bg-white px-2 py-0.5" aria-label="Not helpful">
                      👎
                    </button>
                  </>
                )}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t-3 border-ink bg-white p-3 sm:rounded-b-[1.6rem]">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                placeholder="Type your question…"
                aria-label="Your message"
                className="min-w-0 flex-1 rounded-full border-2 border-ink px-4 py-2 outline-none focus:ring-2 focus:ring-pink"
              />
              <button type="submit" disabled={!text.trim() || busy} className="rounded-full border-2 border-ink bg-lime px-4 font-bold disabled:opacity-50">
                Send
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
              <button type="button" onClick={askHuman} className="shrink-0 whitespace-nowrap font-bold text-ink underline">
                🙋 Talk to a person
              </button>
              <span className="text-right">AI can make mistakes</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
