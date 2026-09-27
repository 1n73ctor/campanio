'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@companio/ui';

type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info' };
const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto max-w-md rounded-chunky border-3 border-ink px-4 py-2.5 text-sm font-semibold shadow-brutal',
              t.tone === 'ok' ? 'bg-lime' : t.tone === 'error' ? 'bg-danger text-white' : 'bg-white',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

/** Shows a one-off message left in sessionStorage by a page that did a full reload (e.g. after deleting an account). */
export function FlashToast() {
  const toast = useToast();
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('companio.flash');
      if (msg) {
        sessionStorage.removeItem('companio.flash');
        toast(msg);
      }
    } catch {}
  }, [toast]);
  return null;
}
