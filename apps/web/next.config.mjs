import { fileURLToPath } from 'url';
import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // monorepo root (silences the multiple-lockfiles warning and traces workspace packages correctly)
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  transpilePackages: ['@companio/ui', '@companio/api-client'],
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      { source: '/.well-known/apple-app-site-association', headers: [{ key: 'Content-Type', value: 'application/json' }] },
      // admin panel (app/(admin)): keep out of search engines
      { source: '/admin', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};
export default nextConfig;
