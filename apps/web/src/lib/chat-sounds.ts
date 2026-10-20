'use client';

/**
 * Tiny chat sounds made with the Web Audio API (no audio files to download). Browsers only allow sound after the
 * visitor has interacted with the page, so the audio context is unlocked on their first tap/click/keypress.
 */
const MUTE_KEY = 'companio.assistant.muted';
let ctx: AudioContext | null = null;
let unlocked = false;

export function soundMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
export function setSoundMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {}
}

/** call once: unlocks audio on the visitor's first interaction */
export function primeSounds() {
  if (typeof window === 'undefined' || unlocked) return;
  const unlock = () => {
    try {
      ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      void ctx.resume();
      unlocked = true;
    } catch {}
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.removeEventListener(ev, unlock);
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, unlock, { once: true, passive: true });
}

function tone(freq: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine', glideTo?: number) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function play(fn: () => void) {
  if (!unlocked || !ctx || soundMuted()) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    fn();
  } catch {}
}

/** a reply arrived: soft rising two-note "pop" */
export const playReceive = () => play(() => (tone(660, 0, 0.09, 0.12, 'sine', 880), tone(990, 0.08, 0.14, 0.1, 'sine', 1320)));
/** message sent: light tick */
export const playSend = () => play(() => tone(520, 0, 0.06, 0.07, 'triangle', 760));
/** the assistant says hello (teaser): gentle chime */
export const playHello = () => play(() => (tone(784, 0, 0.18, 0.08), tone(1175, 0.12, 0.28, 0.07)));
