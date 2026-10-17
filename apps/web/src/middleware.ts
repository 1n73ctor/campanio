import { NextResponse, type NextRequest } from 'next/server';

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const TTL = 5_000;
let cached: { on: boolean; at: number } | null = null;

/** Is the site under maintenance? Asked of the API at most every 5s; if the API can't be reached, the site stays open. */
async function maintenance() {
  if (cached && Date.now() - cached.at < TTL) return cached.on;
  try {
    const r = await fetch(`${API}/meta/status`, { cache: 'no-store', signal: AbortSignal.timeout(1500) });
    const on = r.ok && (await r.json()).maintenance === true;
    cached = { on, at: Date.now() };
  } catch {
    cached = { on: cached?.on ?? false, at: Date.now() };
  }
  return cached.on;
}

/** Maintenance mode: every website page shows "back soon" (the admin panel stays open to switch it off). */
export async function middleware(req: NextRequest) {
  const on = await maintenance();
  const { pathname } = req.nextUrl;
  if (pathname === '/maintenance') return on ? NextResponse.next() : NextResponse.redirect(new URL('/', req.url));
  if (!on) return NextResponse.next();
  const res = NextResponse.rewrite(new URL('/maintenance', req.url), { status: 503 });
  res.headers.set('Retry-After', '300');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = {
  // pages only: not the admin panel, Next's own files, icons, the service worker or SEO files
  matcher: ['/((?!admin|_next|pwa-icon|icon|apple-icon|opengraph-image|manifest|robots\\.txt|sitemap\\.xml|sw\\.js|favicon|\\.well-known|files/|uploads/).*)'],
};
