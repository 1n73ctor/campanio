import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmailView } from './verify-email-view';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}
