'use client';

import { createApiClient, type ApiClient } from '@companio/api-client';
import type { UserDto } from '@companio/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const KEY = 'companio.admin.token';
const read = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

interface Ctx {
  api: ApiClient;
  admin: UserDto | null;
  token: string | null;
  ready: boolean;
  signIn: (t: string, u: UserDto) => void;
  signOut: () => void;
}
const AdminCtx = createContext<Ctx | null>(null);

/** Admin sessions live in sessionStorage (cleared when the tab closes) and expire server-side after 12h. */
export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<UserDto | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    setAdmin(null);
    setToken(null);
  }, []);
  const api = useMemo(() => createApiClient({ baseUrl: API_URL, getToken: read, onUnauthorized: signOut }), [signOut]);

  useEffect(() => {
    const t = read();
    setToken(t);
    if (!t) return setReady(true);
    api.me
      .get()
      .then((u) => (u.role === 'ADMIN' ? setAdmin(u) : signOut()))
      .catch(signOut)
      .finally(() => setReady(true));
  }, [api, signOut]);

  const signIn = useCallback((t: string, u: UserDto) => {
    try {
      sessionStorage.setItem(KEY, t);
    } catch {}
    setToken(t);
    setAdmin(u);
  }, []);

  return <AdminCtx.Provider value={{ api, admin, token, ready, signIn, signOut }}>{children}</AdminCtx.Provider>;
}

export const useAdmin = () => {
  const c = useContext(AdminCtx);
  if (!c) throw new Error('useAdmin outside provider');
  return c;
};

/** Load helper with reload + error state. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    fn()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Failed'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, reload: () => setN((x) => x + 1) };
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
