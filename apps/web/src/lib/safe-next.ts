/**
 * Where to go after sign-in/onboarding, from ?next=. Only paths on this site are allowed, so a link like
 * /login?next=https://evil.example can't bounce people to another site after they sign in (open redirect).
 */
export function safeNext(raw: string | null | undefined, fallback = '/explore'): string {
  if (!raw) return fallback;
  // must be a single-slash path; reject //host, /\host, backslashes and control characters
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\s\u0000-\u001f]/.test(raw)) return fallback;
  try {
    const u = new URL(raw, 'https://companio.invalid');
    return u.origin === 'https://companio.invalid' ? `${u.pathname}${u.search}${u.hash}` : fallback;
  } catch {
    return fallback;
  }
}
