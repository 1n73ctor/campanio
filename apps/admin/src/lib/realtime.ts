'use client';

import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';
import { API_URL, useAdmin } from './api';

let socket: Socket | null = null;

export function useAdminRealtime(handlers: Record<string, (d: unknown) => void>) {
  const { token } = useAdmin();
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!token) return;
    socket ??= io(`${API_URL}/rt`, { auth: { token }, transports: ['websocket', 'polling'] });
    const s = socket;
    const bound = Object.keys(ref.current).map((n) => {
      const fn = (d: unknown) => ref.current[n]?.(d);
      s.on(n, fn);
      return [n, fn] as const;
    });
    return () => bound.forEach(([n, fn]) => s.off(n, fn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
