'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { CONSENT_CHANGED, TRACKING_ENABLED, getConsent } from '@/lib/analytics';
import { playHello, playReceive, playSend, primeSounds, setSoundMuted, soundMuted } from '@/lib/chat-sounds';

type Msg = { role: 'user' | 'assistant' | 'agent' | 'note'; content: string; name?: string | null };
/** talking to the team (their messages wait for a person instead of the AI) */
const LIVE = ['waiting', 'answered'];

const STYLES = `
@keyframes cmp-pop-in { 0% { transform: scale(0) rotate(-20deg); opacity: 0 } 70% { transform: scale(1.12) rotate(4deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
@keyframes cmp-bob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes cmp-ring { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.7); opacity: 0 } }
@keyframes cmp-panel-in { 0% { transform: translateY(16px) scale(.92); opacity: 0 } 100% { transform: none; opacity: 1 } }
@keyframes cmp-msg-in { 0% { transform: translateY(8px); opacity: 0 } 100% { transform: none; opacity: 1 } }
@keyframes cmp-teaser-in { 0% { transform: translateY(10px) scale(.9); opacity: 0 } 100% { transform: none; opacity: 1 } }
@keyframes cmp-wave { 0%, 60%, 100% { transform: rotate(0) } 10%, 30% { transform: rotate(16deg) } 20%, 40% { transform: rotate(-10deg) } }
.cmp-bubble { animation: cmp-pop-in .55s cubic-bezier(.2,1.4,.4,1) both, cmp-bob 3.2s ease-in-out 1.2s infinite }
.cmp-ring { animation: cmp-ring 1.8s ease-out infinite }
.cmp-panel { animation: cmp-panel-in .28s cubic-bezier(.2,1.2,.4,1) both; transform-origin: bottom right }
.cmp-msg { animation: cmp-msg-in .25s ease-out both }
.cmp-teaser { animation: cmp-teaser-in .35s cubic-bezier(.2,1.3,.4,1) both; transform-origin: bottom right }
.cmp-wave { display: inline-block; animation: cmp-wave 2.4s ease-in-out 1 }
@media (prefers-reduced-motion: reduce) { .cmp-bubble, .cmp-ring, .cmp-panel, .cmp-msg, .cmp-teaser, .cmp-wave { animation: none !important } }
`;

/** the little greeting next to the bubble, matched to what the visitor is looking at */
function teaserFor(path: string, signedIn: boolean) {
  if (path.startsWith('/companions/')) return 'Questions about this host? Ask me 👋';
  if (path.startsWith('/become-a-companion') || path.startsWith('/companion')) return 'Thinking of hosting? Ask me anything 💬';
  if (path.startsWith('/wallet')) return 'Need help with coins or payouts?';
  if (path.startsWith('/bookings')) return 'Questions about a meetup? I’m here 🙂';
  if (path.startsWith('/explore')) return 'Looking for the right buddy? I can help you choose ✨';
  if (path.startsWith('/safety')) return 'Any safety questions? Ask me 🛡️';
  return signedIn ? 'Hi again! 👋 Need anything?' : 'Hi! 👋 Need help finding a buddy?';
}
const TEASER_SEEN = 'companio.assistant.teaser';
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
 * (read-only); "Talk to a person" hands the conversation to the team, who reply from Admin → Assistant into this same
 * window (it checks for replies every few seconds while the chat is with the team).
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
  const [teaser, setTeaser] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [human, setHuman] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const seen = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    primeSounds();
    setMuted(soundMuted());
  }, []);

  // a friendly nudge a few seconds after landing — once per visit, and never while the chat is open
  useEffect(() => {
    if (!on || open) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(TEASER_SEEN) === '1';
    } catch {}
    if (seen) return;
    const t = setTimeout(() => {
      setTeaser(teaserFor(path ?? '/', !!user));
      playHello();
      try {
        sessionStorage.setItem(TEASER_SEEN, '1');
      } catch {}
    }, 6000);
    return () => clearTimeout(t);
  }, [on, open, path, user]);

  // switched on from Admin → Assistant (and only once the server has an AI key)
  useEffect(() => {
    if (!ready || viewAs) return;
    api.assistant
      .status()
      .then((s) => {
        setOn(s.enabled);
        setName(s.name);
      })
      .catch(() => {});
  }, [api, ready, viewAs]);

  // wait until the cookie banner has been answered (it would cover it on phones)
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
        setMsgs(h.messages.map((m) => ({ role: m.role, content: m.content, name: m.name })));
        seen.current = h.messages.length;
        setHuman(h.human);
        setRated((h.rating as 1 | -1 | null) ?? null);
      })
      .catch(() => save(undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // after a reload, find out whether this browser's chat is with the team (to keep checking for their replies)
  useEffect(() => {
    if (!on) return;
    const k = read();
    if (!k) return;
    setKey(k);
    api.assistant
      .history(k)
      .then((h) => {
        setHuman(h.human);
        seen.current = h.messages.length;
      })
      .catch(() => {});
  }, [api, on]);

  // while the team has the chat: check for their replies every few seconds (open) or now and then (closed → badge)
  useEffect(() => {
    if (!key || !human || !LIVE.includes(human)) return;
    let stop = false;
    const tick = async () => {
      const h = await api.assistant.history(key).catch(() => null);
      if (!h || stop) return;
      setHuman(h.human);
      if (h.messages.length === seen.current) return;
      const fresh = h.messages.slice(seen.current);
      seen.current = h.messages.length;
      setMsgs(h.messages.map((m) => ({ role: m.role, content: m.content, name: m.name })));
      if (fresh.some((m) => m.role === 'agent' || m.role === 'note')) {
        playReceive();
        if (!open) setUnread((n) => n + fresh.filter((m) => m.role === 'agent').length);
      }
    };
    const t = setInterval(tick, open ? 3000 : 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [api, key, human, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length, busy, open]);

  if (!on || viewAs || hiddenForCookies || path?.startsWith('/view-as')) return null;

  const send = async (message: string) => {
    const m = message.trim();
    if (!m || busy) return;
    playSend();
    setText('');
    setMsgs((x) => [...x, { role: 'user', content: m }]);
    setBusy(true);
    try {
      const r = await api.assistant.chat(m, key);
      setKey(r.conversationKey);
      save(r.conversationKey);
      setHuman(r.human);
      seen.current += 1;
      if (r.reply !== null) {
        setMsgs((x) => [...x, { role: 'assistant', content: r.reply as string }]);
        seen.current += 1;
        playReceive();
      }
      if (r.handoff) await reload(r.conversationKey);
    } catch (e) {
      setMsgs((x) => [...x, { role: 'note', content: errMsg(e) }]);
    } finally {
      setBusy(false);
    }
  };

  const reload = async (k: string) => {
    const h = await api.assistant.history(k).catch(() => null);
    if (!h) return;
    setMsgs(h.messages.map((m) => ({ role: m.role, content: m.content, name: m.name })));
    seen.current = h.messages.length;
    setHuman(h.human);
  };

  const askHuman = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.assistant.human(key);
      setKey(r.conversationKey);
      save(r.conversationKey);
      await reload(r.conversationKey);
      playReceive();
    } catch (e) {
      setMsgs((x) => [...x, { role: 'note', content: errMsg(e) }]);
    } finally {
      setBusy(false);
    }
  };
  const withTeam = !!human && LIVE.includes(human);

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
    setHuman(null);
    seen.current = 0;
  };

  const starters = user
    ? ['Where’s my refund?', 'How many coins do I have?', 'Is my booking confirmed?', 'How do I become a host?']
    : ['How does booking work?', 'Is it safe?', 'How much does it cost?', 'How do I become a host?'];

  return (
    <>
      <style>{STYLES}</style>
      {!open && (
        <div className="fixed bottom-24 right-4 z-[55] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
          {teaser && (
            <div className="cmp-teaser relative flex max-w-[250px] items-start gap-2 rounded-2xl rounded-br-sm border-3 border-ink bg-white px-3 py-2 text-sm font-semibold shadow-brutal-sm">
              <button type="button" onClick={() => (setTeaser(null), setOpen(true))} className="text-left">
                {teaser}
              </button>
              <button type="button" onClick={() => setTeaser(null)} aria-label="Dismiss" className="-mr-1 -mt-0.5 px-1 text-ink-mute hover:text-ink">
                ×
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => (setTeaser(null), setOpen(true))}
            aria-label={`Chat with ${name}, Companio’s assistant`}
            className="cmp-bubble group relative flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-pink shadow-brutal transition-transform hover:scale-110 active:scale-95"
          >
            {teaser && <span className="cmp-ring pointer-events-none absolute inset-0 rounded-full border-4 border-pink" aria-hidden />}
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden className="transition-transform group-hover:-rotate-6">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="#fff" stroke="#141414" strokeWidth="1.8" strokeLinejoin="round" />
              <circle cx="9" cy="9.6" r="1.2" fill="#141414" />
              <circle cx="12" cy="9.6" r="1.2" fill="#141414" />
              <circle cx="15" cy="9.6" r="1.2" fill="#141414" />
            </svg>
            {(teaser || unread > 0) && (
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-lime text-xs font-extrabold" aria-label={`${unread || 1} new message${unread > 1 ? 's' : ''}`}>
                {unread || 1}
              </span>
            )}
          </button>
        </div>
      )}
      {open && (
        <div
          role="dialog"
          aria-label={`Chat with ${name}`}
          className="cmp-panel fixed inset-0 z-[70] flex flex-col bg-paper sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:max-h-[calc(100vh-48px)] sm:w-[390px] sm:rounded-blob sm:border-3 sm:border-ink sm:shadow-brutal"
        >
          <div className="flex items-center gap-3 border-b-3 border-ink bg-pink px-4 py-3 sm:rounded-t-[1.6rem]">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full border-3 border-ink bg-white text-lg">
              {withTeam ? '🙋' : '✨'}<span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink bg-lime" aria-label="online" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold leading-tight">{withTeam ? 'Companio team' : name}</p>
              <p className="text-xs font-semibold">{withTeam ? 'A person will reply in this chat' : 'Companio AI assistant · replies instantly'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSoundMuted(!muted);
                setMuted(!muted);
              }}
              aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
              title={muted ? 'Sound off' : 'Sound on'}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white text-base"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button type="button" onClick={fresh} className="rounded-full px-2 text-xs font-bold underline" title="Start a new chat">
              New
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white font-bold">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[15px]">
            <div className="cmp-msg max-w-[85%] rounded-2xl rounded-tl-sm border-2 border-ink bg-white px-3 py-2">
              Hi{user?.name ? ` ${user.name.split(' ')[0]}` : ''}! <span className="cmp-wave">👋</span> I’m {name}, Companio’s AI assistant. Ask me anything about meetups, safety, hosting or your account — or tap “Talk to a person”.
            </div>
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="cmp-msg rounded-full border-2 border-ink bg-sunny-soft px-3 py-1.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 hover:bg-sunny active:scale-95">
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
                <div key={i} className={cn('cmp-msg flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl border-2 border-ink px-3 py-2', m.role === 'user' ? 'rounded-tr-sm bg-pink-soft' : m.role === 'agent' ? 'rounded-tl-sm bg-lime-soft' : 'rounded-tl-sm bg-white')}>
                    {m.role === 'agent' && <p className="mb-0.5 text-xs font-extrabold">{m.name ?? 'Companio'} · Companio team</p>}
                    {m.role === 'assistant' ? <Rich text={m.content} /> : m.content}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex">
                <div className="cmp-msg flex items-center gap-2 rounded-2xl rounded-tl-sm border-2 border-ink bg-white px-3 py-2.5" aria-label={`${name} is typing`}>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-pink" style={{ animationDelay: `${d * 150}ms` }} />
                    ))}
                  </span>
                  <span className="text-xs font-semibold text-ink-soft">{name} is typing…</span>
                </div>
              </div>
            )}
            {withTeam && (
              <p className="cmp-msg rounded-xl border-2 border-dashed border-ink/30 px-3 py-2 text-center text-xs text-ink-soft">
                Write your message here and someone from the team will reply in this chat. It’s saved on this device, so you can close it and come back.
                {!user && ' Add your email or phone number if you’d like us to reach you another way.'}
              </p>
            )}
            {key && !withTeam && msgs.some((m) => m.role === 'assistant') && !busy && (
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
                placeholder={withTeam ? 'Write to the team…' : 'Type your question…'}
                aria-label="Your message"
                className="min-w-0 flex-1 rounded-full border-2 border-ink px-4 py-2 outline-none focus:ring-2 focus:ring-pink"
              />
              <button type="submit" disabled={!text.trim() || busy} className="rounded-full border-2 border-ink bg-lime px-4 font-bold disabled:opacity-50">
                Send
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
              {withTeam ? (
                <span className="font-bold text-ink">🙋 You’re chatting with the team</span>
              ) : (
                <button type="button" onClick={askHuman} disabled={busy} className="shrink-0 whitespace-nowrap font-bold text-ink underline disabled:opacity-50">
                  🙋 Talk to a person
                </button>
              )}
              <span className="text-right">{withTeam ? 'Replies come here' : 'AI can make mistakes'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
