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

/**
 * Maintenance mode: every website page answers with the "back soon" page (the admin panel stays open to switch it off).
 * The page is sent straight from here, not rewritten to a route: behind nginx, Next would treat that rewrite as a
 * request to an external site.
 */
export async function middleware(_req: NextRequest) {
  if (!(await maintenance())) return NextResponse.next();
  return new NextResponse(PAGE, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '300', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

export const config = {
  // pages only: not the admin panel, Next's own files, icons, the service worker or SEO files
  matcher: ['/((?!admin|_next|pwa-icon|icon|apple-icon|opengraph-image|manifest|robots\\.txt|sitemap\\.xml|sw\\.js|favicon|\\.well-known|files/|uploads/).*)'],
};

const PAGE = `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#FF7AC6"><meta name="robots" content="noindex"><title>Back soon · Companio</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;color:#141414;
    font-family:ui-rounded,"Segoe UI",system-ui,-apple-system,Arial,sans-serif;background:#FFF8EE;
    background-image:radial-gradient(#14141422 1.2px,transparent 1.2px);background-size:22px 22px}
  .card{width:100%;max-width:440px;background:#fff;border:3px solid #141414;border-radius:28px;box-shadow:6px 6px 0 #141414;padding:36px 28px;text-align:center}
  .logo{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:24px}
  .mark{width:40px;height:40px;border:3px solid #141414;border-radius:12px;background:#FF7AC6;box-shadow:2px 2px 0 #141414;transform:rotate(-6deg);display:inline-flex;align-items:center;justify-content:center}
  .icon{font-size:56px;margin:28px 0 8px}
  h1{font-size:30px;line-height:1.15;margin:8px 0 12px;font-weight:900}
  p{color:#3a3a3a;line-height:1.55;margin:0}
  button{margin-top:24px;font:inherit;font-weight:800;font-size:17px;background:#C6F432;border:3px solid #141414;border-radius:999px;padding:10px 26px;box-shadow:3px 3px 0 #141414;cursor:pointer}
  .foot{margin-top:24px;padding-top:16px;border-top:2px dashed #14141426;font-size:14px}
</style></head>
<body><main class="card">
  <div class="logo"><span class="mark"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="3" fill="#141414"/><circle cx="16" cy="9" r="3" fill="#141414"/><path d="M3 18c1.5-3 3.5-4 5-4s3.5 1 5 4M11 18c1.5-3 3.5-4 5-4s3.5 1 5 4" stroke="#141414" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg></span>companio</div>
  <div class="icon" aria-hidden="true">🛠️</div>
  <h1>We’ll be right back</h1>
  <p>Companio is getting a quick tune-up. Your meetups, wallet and messages are safe — nothing is lost. Please check back in a few minutes.</p>
  <button id="again" type="button">Try again</button>
  <p class="foot">In a meetup and feel unsafe? Call <b>112</b>.</p>
</main>
<script>
  (function () {
    var btn = document.getElementById('again');
    function check() {
      btn.textContent = 'Checking…';
      // ask this same page again (same site, so no CORS): anything but 503 means the site is open
      fetch(location.href, { method: 'HEAD', cache: 'no-store' })
        .then(function (r) { if (r.status !== 503) location.reload(); })
        .catch(function () {})
        .then(function () { btn.textContent = 'Try again'; });
    }
    btn.addEventListener('click', check);
    setInterval(check, 20000);
  })();
</script>
</body></html>`;
