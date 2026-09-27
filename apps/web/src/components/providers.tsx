'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { FlashToast, ToastProvider } from './toast';
import { PwaRegister } from './pwa';
import { Analytics } from './analytics';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
        <PwaRegister />
        <Analytics />
        <FlashToast />
      </ToastProvider>
    </AuthProvider>
  );
}
