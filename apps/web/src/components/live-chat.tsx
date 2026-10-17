'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { TAWK_PROPERTY_ID, TAWK_WIDGET_ID } from '@/lib/env';

type TawkApi = {
  onLoad?: () => void;
  setAttributes?: (attrs: Record<string, string>, cb?: (err?: unknown) => void) => void;
  customStyle?: unknown;
  hideWidget?: () => void;
};
declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

let loaded = false;

/**
 * Tawk.to live-chat bubble on the website (never in the admin panel, and never while an admin is viewing as someone).
 * Signed-in people are introduced to the agent by name and email — never their phone number.
 */
export function LiveChat() {
  const { user, ready, viewAs } = useAuth();

  useEffect(() => {
    if (!TAWK_PROPERTY_ID || !TAWK_WIDGET_ID || !ready || viewAs || loaded) return;
    loaded = true;
    const api: TawkApi = (window.Tawk_API = window.Tawk_API || {});
    window.Tawk_LoadStart = new Date();
    // sit a little higher on phones so the bubble never covers chat inputs and buttons at the bottom of the screen
    api.customStyle = { visibility: { mobile: { position: 'br', xOffset: 12, yOffset: 84 } } };
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`;
    s.charset = 'UTF-8';
    s.setAttribute('crossorigin', '*');
    document.body.appendChild(s);
  }, [ready, viewAs]);

  // tell the agent who they're talking to (once the widget is up, and again after signing in)
  useEffect(() => {
    if (!loaded || !user) return;
    const attrs: Record<string, string> = { name: user.name ?? 'Member', id: user.id, role: user.companion ? 'Host' : 'Member' };
    if (user.email && user.emailVerified) attrs.email = user.email;
    const api = window.Tawk_API;
    if (!api) return;
    const send = () => api.setAttributes?.(attrs, () => {});
    if (api.setAttributes) send();
    else api.onLoad = send;
  }, [user]);

  return null;
}
