'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from './toast';
import { PwaRegister } from './pwa';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
        <PwaRegister />
      </ToastProvider>
    </AuthProvider>
  );
}
