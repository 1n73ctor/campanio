import { fileURLToPath } from 'url';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').origin;
const wsOrigin = apiOrigin.replace(/^http/, 'ws');
const firebaseAuthDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com` : '');

/**
 * Content Security Policy: the only places this site may load code, frames and data from. If a script were ever
 * injected, the browser still refuses to load anything from, or send data to, anywhere else.
 * Allowed: our API (+ websocket), Firebase/reCAPTCHA (phone sign-in), Razorpay (payments), GA + Meta Pixel (with
 * cookie consent) and OpenStreetMap (trusted-contact map). 'unsafe-inline' scripts are needed by Next.js's inline
 * bootstrap; React's escaping is the primary defence against injected markup.
 * Production only — `next dev` needs eval() for hot reload.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://*.razorpay.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://apis.google.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiOrigin} https://www.googletagmanager.com https://*.google-analytics.com https://www.facebook.com https://*.razorpay.com https://www.gstatic.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${wsOrigin} https://*.googleapis.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://www.facebook.com https://*.razorpay.com https://www.google.com`,
  `frame-src https://*.razorpay.com https://www.google.com https://recaptcha.google.com https://www.openstreetmap.org${firebaseAuthDomain ? ` https://${firebaseAuthDomain}` : ''}`,
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(apiOrigin.startsWith('https:') ? ['upgrade-insecure-requests'] : []),
].join('; ');

/** Applied to every page (website and /admin). */
const securityHeaders = [
  ...(isProd ? [{ key: 'Content-Security-Policy', value: csp }] : []),
  { key: 'X-Frame-Options', value: 'DENY' }, // no framing → no clickjacking of booking/admin pages
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), usb=(), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // monorepo root (silences the multiple-lockfiles warning and traces workspace packages correctly)
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  transpilePackages: ['@companio/ui', '@companio/api-client'],
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      { source: '/.well-known/apple-app-site-association', headers: [{ key: 'Content-Type', value: 'application/json' }] },
      // admin panel (app/(admin)): keep out of search engines
      { source: '/admin', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};
export default nextConfig;
