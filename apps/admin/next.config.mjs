import { fileURLToPath } from 'url';
import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // served at <website>/admin: the website proxies /admin/* here (see ADMIN_URL in apps/web/next.config.mjs)
  basePath: '/admin',
  // monorepo root (silences the multiple-lockfiles warning and traces workspace packages correctly)
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  transpilePackages: ['@companio/ui', '@companio/api-client'],
  poweredByHeader: false,
  // internal tool: keep it out of search engines
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};
export default nextConfig;
