'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AdminStatsDto } from '@companio/types';
import { Avatar, Button, Card, Field, Input, Logo, cn } from '@companio/ui';
import { AdminProvider, errMsg, useAdmin } from '@/lib/api';
import { useAdminRealtime } from '@/lib/realtime';
import { ToastProvider, useToast } from './toast';
import { Loading } from './ui';

type Counts = Pick<AdminStatsDto, 'pendingKyc' | 'openDisputes' | 'openReports' | 'activeSos' | 'pendingPayouts'>;

const NAV: { href: string; label: string; icon: string; count?: keyof Counts; urgent?: boolean }[] = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/sos', label: 'SOS alerts', icon: '🚨', count: 'activeSos', urgent: true },
  { href: '/kyc', label: 'Verification', icon: '🪪', count: 'pendingKyc' },
  { href: '/disputes', label: 'Disputes', icon: '⚖️', count: 'openDisputes' },
  { href: '/moderation', label: 'Moderation', icon: '🚩', count: 'openReports' },
  { href: '/payouts', label: 'Payouts', icon: '🏦', count: 'pendingPayouts' },
  { href: '/bookings', label: 'Bookings & refunds', icon: '📅' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/reviews', label: 'Reviews', icon: '⭐' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
  { href: '/audit', label: 'Audit log', icon: '🧾' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <ToastProvider>
        <Gate>{children}</Gate>
      </ToastProvider>
    </AdminProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { admin, ready } = useAdmin();
  if (!ready) return <Loading />;
  if (!admin) return <Login />;
  return <Frame>{children}</Frame>;
}

function Frame({ children }: { children: ReactNode }) {
  const { api, admin, signOut } = useAdmin();
  const pathname = usePathname();
  const toast = useToast();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => api.admin.stats().then(setCounts).catch(() => {}), [api]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh, pathname]);
  useEffect(() => setOpen(false), [pathname]);

  useAdminRealtime({
    'sos:new': () => {
      toast('🚨 New SOS alert!', 'error');
      refresh();
    },
    'dispute:new': () => {
      toast('New dispute raised', 'info');
      refresh();
    },
    'report:new': () => refresh(),
    'message:flagged': () => refresh(),
  });

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className={cn('fixed inset-y-0 left-0 z-40 w-[260px] overflow-y-auto border-r-3 border-ink bg-ink text-paper transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-2 px-5 py-5 [&_span]:text-paper">
          <Logo />
          <span className="rounded-md bg-lime px-1.5 py-0.5 text-[10px] font-extrabold !text-ink">ADMIN</span>
        </div>
        <nav className="space-y-1 px-3 pb-6">
          {NAV.map((n) => {
            const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            const c = n.count && counts ? counts[n.count] : 0;
            return (
              <Link key={n.href} href={n.href} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold', active ? 'bg-paper text-ink' : 'hover:bg-paper/10')}>
                <span aria-hidden>{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                {c > 0 && <span className={cn('rounded-full px-2 py-0.5 text-xs font-extrabold text-ink', n.urgent ? 'animate-pulse bg-danger text-white' : 'bg-sunny')}>{c}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-paper/15 px-5 py-4 text-sm">
          <div className="flex items-center gap-2">
            <Avatar name={admin?.name} size={32} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{admin?.name}</p>
              <p className="truncate text-xs text-paper/60">{admin?.email}</p>
            </div>
          </div>
          <button onClick={signOut} className="mt-3 text-xs font-semibold underline">
            Sign out
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b-3 border-ink bg-paper px-4 lg:hidden">
          <button className="h-9 w-9 rounded-lg border-3 border-ink bg-white" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <Logo />
        </header>
        {counts && counts.activeSos > 0 && !pathname.startsWith('/sos') && (
          <Link href="/sos" className="block border-b-3 border-ink bg-danger px-4 py-2 text-center text-sm font-extrabold text-white">
            🚨 {counts.activeSos} active SOS alert{counts.activeSos > 1 ? 's' : ''} — respond now →
          </Link>
        )}
        <main className="mx-auto max-w-7xl p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

function Login() {
  const { api, signIn } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="dots flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-7">
        <div className="mb-6 flex items-center gap-2">
          <Logo />
          <span className="rounded-md bg-lime px-1.5 py-0.5 text-[10px] font-extrabold">ADMIN</span>
        </div>
        <h1 className="text-2xl font-extrabold">Staff sign in</h1>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await api.auth.adminLogin(email, password);
              signIn(r.token, r.user);
            } catch (err) {
              setError(errMsg(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password" error={error}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
