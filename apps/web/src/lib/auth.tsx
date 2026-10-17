'use client';

import { createApiClient, type ApiClient } from '@companio/api-client';
import type { UserDto } from '@companio/types';
import { useRouter, usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { API_URL } from './env';

const TOKEN_KEY = 'companio.token';
/**
 * An admin's read-only "log in as" session. Kept in sessionStorage, so it lives only in the tab the admin opened and
 * never replaces anyone's own sign-in (closing the tab ends it).
 */
export const VIEW_AS_KEY = 'companio.viewAs';
export interface ViewAs {
  token: string;
  expiresAt: string;
  /** the admin page to go back to */
  back: string;
}

export const readViewAs = (): ViewAs | null => {
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_AS_KEY) ?? 'null') as ViewAs | null;
    if (v?.token && new Date(v.expiresAt).getTime() > Date.now()) return v;
    if (v) sessionStorage.removeItem(VIEW_AS_KEY);
  } catch {}
  return null;
};

export const endViewAs = () => {
  try {
    sessionStorage.removeItem(VIEW_AS_KEY);
  } catch {}
};

const readToken = () => {
  const v = readViewAs();
  if (v) return v.token;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

interface AuthCtx {
  api: ApiClient;
  token: string | null;
  user: UserDto | null;
  ready: boolean;
  signIn: (token: string, user: UserDto) => void;
  signOut: () => void;
  refresh: () => Promise<UserDto | null>;
  setUser: (u: UserDto) => void;
  /** set while an admin is viewing the site as this user (read-only) */
  viewAs: ViewAs | null;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserDto | null>(null);
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState<ViewAs | null>(null);

  const signOut = useCallback(() => {
    // ending a view-as session never touches the real sign-in kept in localStorage
    if (readViewAs()) endViewAs();
    else
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {}
    setViewAs(null);
    setToken(null);
    setUser(null);
  }, []);

  const api = useMemo(() => createApiClient({ baseUrl: API_URL, getToken: readToken, onUnauthorized: signOut }), [signOut]);

  const refresh = useCallback(async () => {
    if (!readToken()) return null;
    try {
      const u = await api.me.get();
      setUser(u);
      return u;
    } catch {
      return null;
    }
  }, [api]);

  useEffect(() => {
    const t = readToken();
    setViewAs(readViewAs());
    setToken(t);
    (t ? refresh() : Promise.resolve(null)).finally(() => setReady(true));
  }, [refresh]);

  const signIn = useCallback((t: string, u: UserDto) => {
    endViewAs();
    setViewAs(null);
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {}
    setToken(t);
    setUser(u);
  }, []);

  return <Ctx.Provider value={{ api, token, user, ready, signIn, signOut, refresh, setUser, viewAs }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

/**
 * Gate for signed-in pages. Redirects to /login (then back), and to onboarding until the profile is complete.
 * Returns the user once ready, else null (render a loader).
 */
export function useRequireAuth(opts: { companion?: boolean; allowUnonboarded?: boolean } = {}) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!user.onboarded && !opts.allowUnonboarded) router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
    else if (opts.companion && !user.companion) router.replace('/become-a-companion');
  }, [ready, user, router, pathname, opts.allowUnonboarded, opts.companion]);
  if (!ready || !user) return null;
  if (!user.onboarded && !opts.allowUnonboarded) return null;
  if (opts.companion && !user.companion) return null;
  return user;
}
