'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { FlashToast, ToastProvider } from './toast';
import { PwaRegister } from './pwa';
import { Analytics } from './analytics';
import { LiveChat } from './live-chat';
import { AssistantWidget } from './assistant-widget';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
        <PwaRegister />
        <Analytics />
        <LiveChat />
        <AssistantWidget />
        <FlashToast />
      </ToastProvider>
    </AuthProvider>
  );
}
