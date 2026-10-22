'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@companio/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { CONSENT_CHANGED, TRACKING_ENABLED, getConsent } from '@/lib/analytics';
import { playHello, playReceive, playSend, primeSounds, setSoundMuted, soundMuted } from '@/lib/chat-sounds';

type Msg = { role: 'user' | 'assistant' | 'agent' | 'note'; content: string; name?: string | null; at?: string };
/** no reply from the team for this long → "all our agents are busy", and we ask for their email */
const BUSY_AFTER = 5 * 60_000;
const TRANSFER_MS = 2800;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const toMsg = (m: { role: Msg['role']; content: string; name: string | null; at: string }): Msg => ({ role: m.role, content: m.content, name: m.name, at: m.at });
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
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
@keyframes cmp-fill { 0% { width: 4% } 100% { width: 100% } }
@keyframes cmp-hop { 0%, 100% { transform: translateY(0) } 40% { transform: translateY(-7px) } }
@keyframes cmp-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,122,198,.55) } 50% { box-shadow: 0 0 0 8px rgba(255,122,198,0) } }
@keyframes cmp-stripes { 0% { background-position: 0 0 } 100% { background-position: 28px 0 } }
.cmp-fill { animation: cmp-fill ${TRANSFER_MS}ms cubic-bezier(.4,.1,.3,1) forwards; background-image: repeating-linear-gradient(45deg, #FF7AC6 0 10px, #ff9bd4 10px 14px); background-size: 28px 100%; }
.cmp-fill-run { animation: cmp-fill ${TRANSFER_MS}ms cubic-bezier(.4,.1,.3,1) forwards, cmp-stripes .6s linear infinite }
.cmp-hop { animation: cmp-hop 1.1s ease-in-out infinite }
.cmp-glow { animation: cmp-glow 1.8s ease-out infinite }
@media (prefers-reduced-motion: reduce) { .cmp-bubble, .cmp-ring, .cmp-panel, .cmp-msg, .cmp-teaser, .cmp-wave, .cmp-hop, .cmp-glow { animation: none !important } .cmp-fill, .cmp-fill-run { animation: none !important; width: 100% } }
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
  const [transferring, setTransferring] = useState(false);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [unread, setUnread] = useState(0);
  const seen = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    primeSounds();
    setMuted(soundMuted());
  }, []);

  // a friendly nudge a few seconds after landing — once per visit, and never while the chat is open
  useEffect(() => {
    // not while they're signing in: on phones it would cover the code box and buttons
    if (!on || open || path?.startsWith('/login') || path?.startsWith('/onboarding')) return;
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
        setMsgs(h.messages.map(toMsg));
        seen.current = h.messages.length;
        setHuman(h.human);
        setContactEmail(h.contactEmail);
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
      setMsgs(h.messages.map(toMsg));
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

  // how long they've been waiting for the team: since their first message (or the transfer) after the team's last reply
  const lastAgent = msgs.map((m) => m.role).lastIndexOf('agent');
  const waitingSince = human === 'waiting' ? msgs.slice(lastAgent + 1).find((m) => (m.role === 'user' || m.role === 'note') && m.at)?.at : undefined;
  const waited = waitingSince ? Math.max(0, now - new Date(waitingSince).getTime()) : 0;
  const agentsBusy = !!waitingSince && waited >= BUSY_AFTER && !contactEmail;

  // signed-in members: suggest the email on their account
  useEffect(() => {
    if (agentsBusy && !email && user?.email) setEmail(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentsBusy]);

  // the waiting timer (and the "all our agents are busy" switch) while the team hasn't replied yet
  useEffect(() => {
    if (human !== 'waiting' || !open) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [human, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length, busy, open]);

  if (!on || viewAs || hiddenForCookies || path?.startsWith('/view-as')) return null;

  const send = async (message: string) => {
    const m = message.trim();
    if (!m || busy) return;
    playSend();
    setText('');
    setMsgs((x) => [...x, { role: 'user', content: m, at: new Date().toISOString() }]);
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
    setMsgs(h.messages.map(toMsg));
    seen.current = h.messages.length;
    setHuman(h.human);
    setContactEmail(h.contactEmail);
  };

  // "Transferring you to an agent…" plays for a moment while the request goes through
  const askHuman = async () => {
    if (busy || transferring) return;
    setTransferring(true);
    const minWait = new Promise((r) => setTimeout(r, TRANSFER_MS));
    try {
      const r = await api.assistant.human(key);
      setKey(r.conversationKey);
      save(r.conversationKey);
      await minWait;
      await reload(r.conversationKey);
      playHello();
    } catch (e) {
      setMsgs((x) => [...x, { role: 'note', content: errMsg(e) }]);
    } finally {
      setTransferring(false);
    }
  };
  const withTeam = !!human && LIVE.includes(human);


  const leaveEmail = async () => {
    const e = email.trim();
    if (!key || !EMAIL_OK.test(e)) return;
    setSavingEmail(true);
    try {
      const r = await api.assistant.contact(key, e);
      setContactEmail(r.contactEmail);
      await reload(key);
      playSend();
    } catch (err) {
      setMsgs((x) => [...x, { role: 'note', content: errMsg(err) }]);
    } finally {
      setSavingEmail(false);
    }
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
    setHuman(null);
    setContactEmail(null);
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
            {msgs.length === 0 && !transferring && (
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
                <div key={i}>
                {m.role === 'agent' && msgs.findIndex((x) => x.role === 'agent') === i && (
                  <p className="cmp-msg mb-2 text-center text-xs font-bold text-ink">
                    <span className="rounded-full border-2 border-ink bg-lime px-2.5 py-0.5">👋 {m.name ?? 'An agent'} joined the chat</span>
                  </p>
                )}
                <div className={cn('cmp-msg flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl border-2 border-ink px-3 py-2', m.role === 'user' ? 'rounded-tr-sm bg-pink-soft' : m.role === 'agent' ? 'rounded-tl-sm bg-lime-soft' : 'rounded-tl-sm bg-white')}>
                    {m.role === 'agent' && <p className="mb-0.5 text-xs font-extrabold">{m.name ?? 'Companio'} · Companio team</p>}
                    {m.role === 'assistant' ? <Rich text={m.content} /> : m.content}
                  </div>
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
            {transferring && (
              <div className="cmp-msg rounded-2xl border-2 border-ink bg-white p-4 text-center" role="status">
                <div className="flex justify-center -space-x-2">
                  {['🙋‍♀️', '🧑‍💼', '🙋‍♂️'].map((e, d) => (
                    <span key={e} className="cmp-hop flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-pink-soft text-xl" style={{ animationDelay: `${d * 160}ms` }}>
                      {e}
                    </span>
                  ))}
                </div>
                <p className="mt-3 font-display font-extrabold">Transferring you to an agent…</p>
                <p className="text-xs text-ink-soft">Hang tight, connecting you to the Companio team</p>
                <div className="mx-auto mt-3 h-2.5 w-full overflow-hidden rounded-full border-2 border-ink bg-paper">
                  <div className="cmp-fill cmp-fill-run h-full rounded-full" />
                </div>
              </div>
            )}
            {!transferring && human === 'waiting' && !agentsBusy && !contactEmail && (
              <div className="cmp-msg flex items-center gap-3 rounded-2xl border-2 border-ink bg-white px-3 py-2.5" role="status">
                <span className="cmp-glow relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-pink-soft text-lg">🧑‍💼</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">An agent will join shortly</p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink" style={{ animationDelay: `${d * 150}ms` }} />
                      ))}
                    </span>
                    Waiting {mmss(waited)}
                  </p>
                </div>
              </div>
            )}
            {!transferring && agentsBusy && (
              <div className="cmp-msg rounded-2xl border-2 border-ink bg-sunny-soft p-3.5">
                <p className="font-display font-extrabold">😔 All our agents are busy right now</p>
                <p className="mt-1 text-sm">Leave your email and we’ll contact you directly as soon as someone’s free.</p>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void leaveEmail();
                  }}
                >
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    placeholder="you@example.com"
                    aria-label="Your email"
                    className="min-w-0 flex-1 rounded-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink"
                  />
                  <button type="submit" disabled={savingEmail || !EMAIL_OK.test(email.trim())} className="rounded-full border-2 border-ink bg-lime px-3 text-sm font-bold disabled:opacity-50">
                    {savingEmail ? '…' : 'Send'}
                  </button>
                </form>
                <p className="mt-2 text-xs text-ink-soft">You can still write here too. We only use your email to reply to this chat.</p>
              </div>
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
                <button type="button" onClick={askHuman} disabled={busy || transferring} className="shrink-0 whitespace-nowrap font-bold text-ink underline disabled:opacity-50">
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
