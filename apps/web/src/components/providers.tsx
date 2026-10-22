'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { FlashToast, ToastProvider } from './toast';
import { PwaRegister } from './pwa';
import { Analytics } from './analytics';
import { AssistantWidget } from './assistant-widget';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
        <PwaRegister />
        <Analytics />
        <AssistantWidget />
        <FlashToast />
      </ToastProvider>
    </AuthProvider>
  );
}
