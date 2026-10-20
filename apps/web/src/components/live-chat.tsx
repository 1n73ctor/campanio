'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { TAWK_PROPERTY_ID, TAWK_WIDGET_ID } from '@/lib/env';
import { CONSENT_CHANGED, TRACKING_ENABLED, getConsent } from '@/lib/analytics';

type TawkApi = {
  onLoad?: () => void;
  setAttributes?: (attrs: Record<string, string>, cb?: (err?: unknown) => void) => void;
  customStyle?: unknown;
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  addEvent?: (name: string, meta: Record<string, string>, cb?: (err?: unknown) => void) => void;
  onChatMinimized?: () => void;
  onLoadCallbacks?: (() => void)[];
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

  // The bubble stays hidden while the cookie banner is open (it would cover it on phones), and whenever our own
  // assistant is on — then Tawk only appears when someone asks for a person (openHumanChat).
  useEffect(() => {
    if (!TAWK_PROPERTY_ID) return;
    const sync = () => {
      const api = window.Tawk_API;
      if (!api?.hideWidget) return;
      if (humanOpen) return;
      if (document.documentElement.dataset.assistant === 'on' || (TRACKING_ENABLED && getConsent() === null)) api.hideWidget();
      else api.showWidget?.();
    };
    window.addEventListener(ASSISTANT_CHANGED, sync);
    whenLoaded(sync);
    window.addEventListener(CONSENT_CHANGED, sync);
    return () => {
      window.removeEventListener(CONSENT_CHANGED, sync);
      window.removeEventListener(ASSISTANT_CHANGED, sync);
    };
  }, [ready, viewAs]);

  // tell the agent who they're talking to (once the widget is up, and again after signing in)
  useEffect(() => {
    if (!loaded || !user) return;
    const attrs: Record<string, string> = { name: user.name ?? 'Member', id: user.id, role: user.companion ? 'Host' : 'Member' };
    if (user.email && user.emailVerified) attrs.email = user.email;
    whenLoaded(() => window.Tawk_API?.setAttributes?.(attrs, () => {}));
  }, [user]);

  return null;
}

/** Runs now if the widget is up, else once it loads (Tawk has a single onLoad slot, so callbacks are queued). */
function whenLoaded(fn: () => void) {
  const api = window.Tawk_API;
  if (!api) return;
  if (api.hideWidget) return fn();
  if (!api.onLoadCallbacks) {
    api.onLoadCallbacks = [];
    api.onLoad = () => api.onLoadCallbacks!.forEach((f) => f());
  }
  api.onLoadCallbacks.push(fn);
}

/** fired when our assistant switches on or off, so the Tawk bubble hides or shows */
export const ASSISTANT_CHANGED = 'companio:assistant-changed';
let humanOpen = false;

/**
 * Hand a conversation from our assistant to a person on Tawk.to: opens the Tawk chat with the summary attached for
 * the agent. Returns false when Tawk isn't set up (the caller shows another way to reach the team).
 */
export function openHumanChat(summary: string) {
  const api = window.Tawk_API;
  if (!TAWK_PROPERTY_ID || !api?.maximize) return false;
  humanOpen = true;
  api.showWidget?.();
  api.maximize();
  api.addEvent?.('from-assistant', { summary: summary.slice(0, 250) }, () => {});
  api.onChatMinimized = () => {
    humanOpen = false;
    if (document.documentElement.dataset.assistant === 'on') api.hideWidget?.();
  };
  return true;
}
