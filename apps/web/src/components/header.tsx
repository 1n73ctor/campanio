'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Logo, buttonClass, cn } from '@companio/ui';
import type { NotificationDto } from '@companio/types';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/socket';
import { useToast } from './toast';

const NAV = [
  { href: '/explore', label: 'Explore' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/safety', label: 'Safety' },
  { href: '/become-a-companion', label: 'Become a host' },
];

/** Fired after notifications are marked read elsewhere, so the bell badge refreshes. */
export const NOTIFICATIONS_CHANGED = 'companio:notifications-changed';

export function SiteHeader() {
  const { user, ready, api, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const toast = useToast();

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => api.notifications.list().then((r) => setUnread(r.unread)).catch(() => {});
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
  }, [user, api, pathname]);

  useRealtime({
    notification: (n: NotificationDto) => {
      setUnread((u) => u + 1);
      toast(n.title, 'info');
    },
  });

  return (
    <header className="sticky top-0 z-40 border-b-3 border-ink bg-paper/95 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-4">
        <Link href="/" aria-label="Companio home">
          <Logo />
        </Link>
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn('rounded-lg px-3 py-2 text-sm font-bold hover:bg-ink/5', pathname.startsWith(n.href) && 'bg-ink/5')}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {ready && user ? (
            <>
              <Link href="/bookings" className="hidden rounded-lg px-3 py-2 text-sm font-bold hover:bg-ink/5 sm:block">
                Bookings
              </Link>
              <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative flex h-10 w-10 items-center justify-center rounded-full border-3 border-ink bg-white">
                <span aria-hidden>🔔</span>
                {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-ink bg-pink px-1 text-[11px] font-extrabold">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <div className="relative">
                <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Account menu">
                  <Avatar name={user.name ?? user.phone} src={user.avatarUrl} size={40} />
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-chunky border-3 border-ink bg-white shadow-brutal">
                    <p className="border-b-2 border-ink/10 px-4 py-2 text-xs text-ink-mute">Signed in as <b className="text-ink">{user.name ?? user.phone}</b></p>
                    {[
                      ...(user.companion ? [{ href: '/companion/dashboard', label: '💼 Host dashboard' }] : []),
                      { href: '/bookings', label: '📅 My meetups' },
                      { href: '/wallet', label: '👛 Wallet' },
                      { href: '/account', label: '⚙️ Account' },
                    ].map((l) => (
                      <Link key={l.href} href={l.href} className="block px-4 py-2 text-sm font-semibold hover:bg-paper">
                        {l.label}
                      </Link>
                    ))}
                    <button onClick={signOut} className="block w-full border-t-2 border-ink/10 px-4 py-2 text-left text-sm font-semibold hover:bg-paper">
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : ready ? (
            <>
              <Link href="/login" className="hidden px-3 text-sm font-bold sm:block">
                Log in
              </Link>
              <Link href="/login" className={buttonClass('primary', 'sm')}>
                Get started
              </Link>
            </>
          ) : (
            <span className="h-10 w-24" />
          )}
          <button className="flex h-10 w-10 items-center justify-center rounded-lg border-3 border-ink bg-white lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? '×' : '☰'}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t-3 border-ink bg-paper lg:hidden">
          <div className="container-x flex flex-col py-2">
            {[...NAV, ...(user ? [{ href: '/bookings', label: 'My meetups' }] : [])].map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-2 py-3 font-bold hover:bg-ink/5">
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
