import { createApiClient } from '@companio/api-client';
import { API_URL } from './env';

/** Server-side client for public, cacheable data (ISR). Never sends user tokens. */
export const serverApi = (revalidate = 300) => createApiClient({ baseUrl: API_URL, fetchInit: { next: { revalidate } } });

/** Swallow API outages on marketing/SEO pages so they still render (with empty lists). */
export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
