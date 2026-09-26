export { formatINR, BOOKING_STATUS_LABEL, humanize } from '@companio/types';

const TZ = 'Asia/Kolkata';

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

export const timeAgo = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
};

/** Today's date (YYYY-MM-DD) in IST, for <input type="date" min>. */
export const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
