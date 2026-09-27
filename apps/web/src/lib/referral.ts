'use client';

const KEY = 'companio.ref';
const TTL = 30 * 24 * 3600_000; // an invite link stays valid for sign-up for 30 days

/** Remembers `?ref=CODE` from any landing URL so it survives browsing until the visitor signs up. */
export function captureRef(search: string) {
  const code = new URLSearchParams(search).get('ref')?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{4,20}$/.test(code)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {}
}

export function getRef(): string | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { code: string; at: number } | null;
    if (v && Date.now() - v.at < TTL) return v.code;
  } catch {}
  return undefined;
}

export function clearRef() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
