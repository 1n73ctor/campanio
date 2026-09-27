'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '@companio/ui';

type T = { id: number; text: string; tone: 'ok' | 'error' | 'info' };
const Ctx = createContext<(text: string, tone?: T['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, tone: T['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn('max-w-sm rounded-chunky border-3 border-ink px-4 py-2.5 text-sm font-semibold shadow-brutal', t.tone === 'ok' ? 'bg-lime' : t.tone === 'error' ? 'bg-danger text-white' : 'bg-sunny')}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
