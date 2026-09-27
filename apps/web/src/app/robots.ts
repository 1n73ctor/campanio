import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/share', '/account', '/bookings', '/wallet', '/checkout', '/book', '/companion/', '/notifications', '/onboarding'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
