'use client';

import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';
import { API_URL } from './env';
import { useAuth } from './auth';

let socket: Socket | null = null;
let socketToken: string | null = null;

function getSocket(token: string) {
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  socket = io(`${API_URL}/rt`, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

/** Subscribe to realtime events. Optionally joins a booking room (chat, live location). */
export function useRealtime(handlers: Record<string, (data: never) => void>, bookingId?: string) {
  const { token } = useAuth();
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!token) return;
    const s = getSocket(token);
    const names = Object.keys(ref.current);
    const bound = names.map((n) => {
      const fn = (d: unknown) => ref.current[n]?.(d as never);
      s.on(n, fn);
      return [n, fn] as const;
    });
    const join = () => bookingId && s.emit('booking:join', { bookingId });
    join();
    s.on('connect', join);
    return () => {
      bound.forEach(([n, fn]) => s.off(n, fn));
      s.off('connect', join);
      if (bookingId) s.emit('booking:leave', { bookingId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, bookingId, Object.keys(handlers).join(',')]);
}
