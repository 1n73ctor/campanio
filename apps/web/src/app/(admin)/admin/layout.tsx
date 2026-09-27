import type { Metadata } from 'next';
import '../../globals.css';
import { fontVars } from '@/lib/fonts';
import { AdminShell } from '@/admin/components/shell';

export const metadata: Metadata = { title: { default: 'Companio Admin', template: '%s · Companio Admin' }, robots: { index: false, follow: false } };

/**
 * Root layout for the admin panel at /admin. It deliberately shares nothing with the website layout (no site header,
 * website login, tracking scripts or cookie banner), and being a separate root layout means every switch between
 * the website and the admin is a full page load, so website scripts never carry over into the admin.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
