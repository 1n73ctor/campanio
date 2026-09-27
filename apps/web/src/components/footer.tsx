import Link from 'next/link';
import { CATEGORIES, CITIES } from '@companio/types';
import { Logo } from '@companio/ui';
import { CookieSettingsLink } from './analytics';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t-3 border-ink bg-ink text-paper">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="[&_span]:text-paper">
            <Logo />
          </div>
          <p className="mt-4 max-w-xs text-sm text-paper/70">
            Rent a friend, not a date. Verified companions for the things that are better together — 100% platonic, 18+, safety-first.
          </p>
          <p className="mt-6 text-xs text-paper/50">Emergency? Call 112. Safety team: safety@companio.app</p>
        </div>
        <FooterCol title="Activities" links={CATEGORIES.slice(0, 6).map((c) => ({ href: `/explore/${c.slug}`, label: c.name }))} />
        <FooterCol title="Cities" links={CITIES.slice(0, 6).map((c) => ({ href: `/explore/city-guide/${c.slug}`, label: c.name }))} />
        <FooterCol
          title="Companio"
          links={[
            { href: '/how-it-works', label: 'How it works' },
            { href: '/safety', label: 'Safety' },
            { href: '/become-a-companion', label: 'Become a companion' },
            { href: '/blog', label: 'Blog' },
            { href: '/community-guidelines', label: 'Community guidelines' },
            { href: '/terms', label: 'Terms' },
            { href: '/privacy', label: 'Privacy' },
          ]}
        />
      </div>
      <div className="border-t border-paper/15 py-5 text-center text-xs text-paper/50">
        © {new Date().getFullYear()} Companio. Strictly platonic companionship. Made in India 🇮🇳
        <CookieSettingsLink className="ml-3 underline hover:text-paper" />
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-lime">{title}</h3>
      <ul className="space-y-2 text-sm text-paper/80">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-paper hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
