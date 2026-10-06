import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Companio — Find a buddy, not a date',
    short_name: 'Companio',
    description: 'Meet verified local hosts for activities you love. Platonic, 18+, safety-first.',
    start_url: '/?source=pwa',
    display: 'standalone',
    background_color: '#FFF8EE',
    theme_color: '#FF7AC6',
    orientation: 'portrait',
    categories: ['lifestyle', 'social'],
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // shortcut icons are required for the Android app (long-press the app icon)
    shortcuts: [
      { name: 'My meetups', url: '/bookings', icons: [{ src: '/pwa-icon/192', sizes: '192x192', type: 'image/png' }] },
      { name: 'Explore', url: '/explore', icons: [{ src: '/pwa-icon/192', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
