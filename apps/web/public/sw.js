/* Companio service worker: offline shell + network-first pages, cache-first static assets, web push. */
const VERSION = 'companio-v1';
const SHELL = ['/', '/explore', '/offline'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache API calls
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/pwa-icon/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(req).then((hit) => hit || caches.match('/offline'))));
  }
});

self.addEventListener('push', (e) => {
  const data = (() => { try { return e.data.json(); } catch { return { title: 'Companio', body: e.data && e.data.text() }; } })();
  e.waitUntil(self.registration.showNotification(data.title || 'Companio', { body: data.body, icon: '/pwa-icon/192', data: { link: data.link || '/' } }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data.link || '/'));
});
