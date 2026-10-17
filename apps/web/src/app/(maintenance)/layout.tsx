import type { Metadata, Viewport } from 'next';
import '../globals.css';
import { fontVars } from '@/lib/fonts';

export const metadata: Metadata = { title: 'Back soon · Companio', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#FF7AC6', width: 'device-width', initialScale: 1 };

/** Bare layout for the maintenance page: no header, sign-in or chat widget (they'd call the API, which is closed). */
export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={fontVars}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
