import { revalidatePath, revalidateTag } from 'next/cache';
import { API_URL } from '@/lib/env';

/**
 * Refreshes the cached public pages (home, Explore, profiles) right away — called by the admin panel after a change
 * visitors should see now (e.g. a host made ⭐ Premium). Only for admins: the token is checked with the API.
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!auth) return Response.json({ ok: false }, { status: 401 });
  const r = await fetch(`${API_URL}/admin/settings`, { headers: { authorization: auth }, cache: 'no-store' }).catch(() => null);
  if (!r?.ok) return Response.json({ ok: false }, { status: 403 });
  revalidateTag('hosts');
  revalidatePath('/', 'layout');
  return Response.json({ ok: true });
}
