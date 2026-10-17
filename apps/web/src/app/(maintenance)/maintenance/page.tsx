import { Logo } from '@companio/ui';
import { BackSoon } from './back-soon';

export const dynamic = 'force-dynamic';

export default function MaintenancePage() {
  return (
    <main className="dots flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-blob border-3 border-ink bg-white p-8 text-center shadow-brutal">
        <div className="flex justify-center">
          <Logo />
        </div>
        <p className="mt-8 text-6xl" aria-hidden>
          🛠️
        </p>
        <h1 className="mt-4 font-display text-3xl font-extrabold">We’ll be right back</h1>
        <p className="mt-3 text-ink-soft">
          Companio is getting a quick tune-up. Your meetups, wallet and messages are safe — nothing is lost. Please check back in a few minutes.
        </p>
        <BackSoon />
        <p className="mt-6 border-t-2 border-dashed border-ink/15 pt-4 text-sm text-ink-soft">
          In a meetup and feel unsafe? Call <b>112</b>.
        </p>
      </div>
    </main>
  );
}
