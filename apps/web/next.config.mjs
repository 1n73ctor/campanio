import { fileURLToPath } from 'url';
import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // monorepo root (silences the multiple-lockfiles warning and traces workspace packages correctly)
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  transpilePackages: ['@companio/ui', '@companio/api-client'],
  poweredByHeader: false,
  // the admin panel is a separate Next app (basePath /admin); proxy it so it lives at <this site>/admin
  async rewrites() {
    const admin = (process.env.ADMIN_URL || '').replace(/\/$/, '');
    if (!admin) return [];
    return { beforeFiles: [{ source: '/admin', destination: `${admin}/admin` }, { source: '/admin/:path*', destination: `${admin}/admin/:path*` }] };
  },
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      { source: '/.well-known/apple-app-site-association', headers: [{ key: 'Content-Type', value: 'application/json' }] },
    ];
  },
};
export default nextConfig;
