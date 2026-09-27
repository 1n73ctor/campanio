import Link from 'next/link';
import { buttonClass } from '@companio/ui';

export default function NotFound() {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-7xl">🫠</p>
      <h1 className="text-4xl font-extrabold">Page not found</h1>
      <p className="text-ink-soft">This page wandered off. Let’s find you some company instead.</p>
      <Link href="/explore" className={buttonClass('primary', 'lg')}>
        Explore companions
      </Link>
    </div>
  );
}
