import type { Metadata, Viewport } from 'next';
import '../globals.css';
import { fontVars } from '@/lib/fonts';
import { Providers } from '@/components/providers';
import { SiteHeader } from '@/components/header';
import { SiteFooter } from '@/components/footer';
import { SITE_NAME, SITE_URL } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Rent a friend, not a date`, template: `%s · ${SITE_NAME}` },
  description: 'Book verified, ID-checked companions for the gym, movies, city walks, events and more. 100% platonic, 18+, safety-first — with escrow payments and SOS.',
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_IN' },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#FF7AC6', width: 'device-width', initialScale: 1 };

/** Root layout for the public website. The admin panel has its own root layout, so moving between them is a full page load. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={fontVars}>
      <body className="min-h-screen">
        <Providers>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
