export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = 'Companio';
/** Tawk.to live chat (dashboard → Administration → Chat Widget: the two IDs in the widget link). Empty = no chat. */
const tawkId = (v: string | undefined) => (/^[a-z0-9]{6,40}$/i.test(v ?? '') ? v! : '');
export const TAWK_PROPERTY_ID = tawkId(process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID);
export const TAWK_WIDGET_ID = tawkId(process.env.NEXT_PUBLIC_TAWK_WIDGET_ID);
