import { WEEKDAYS, type Availability } from '@companio/types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const IST = 330 * MIN;
/** bookings must start at least this far ahead (see BookingsService.create) */
export const BOOKING_LEAD = 2 * HOUR;

type Busy = { startAt: Date; endAt: Date };
type Window = { start: number; end: number };

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** booking start times are on the hour or half hour */
const ceil30 = (t: number) => Math.ceil(t / (30 * MIN)) * 30 * MIN;
/** UTC timestamp of midnight IST on the IST day containing `t` */
const istMidnight = (t: number) => Math.floor((t + IST) / DAY) * DAY - IST;
const istWeekday = (t: number) => (new Date(t + IST).getUTCDay() + 6) % 7; // 0 = Monday

/** Free time between `from` and `to`: weekly IST availability minus busy bookings. */
export function freeWindows(av: Availability, busy: Busy[], from: number, to: number): Window[] {
  const out: Window[] = [];
  for (let day = istMidnight(from); day < to; day += DAY) {
    for (const slot of av[WEEKDAYS[istWeekday(day)]] ?? []) {
      let segs: Window[] = [{ start: Math.max(day + toMinutes(slot.from) * MIN, from), end: Math.min(day + toMinutes(slot.to) * MIN, to) }];
      for (const b of busy) {
        const bs = b.startAt.getTime();
        const be = b.endAt.getTime();
        segs = segs.flatMap((s) => (be <= s.start || bs >= s.end ? [s] : [{ start: s.start, end: bs }, { start: be, end: s.end }]));
      }
      out.push(...segs.filter((s) => s.end > s.start));
    }
  }
  return out;
}

const hasBlock = (windows: Window[], minLength: number) => windows.some((w) => w.end - ceil30(w.start) >= minLength);

/**
 * "Free today" = a bookable hour later today; "free this weekend" = 2 bookable hours on the coming Sat/Sun.
 * Companions without weekly hours get no badge (bookable any time, but we can't promise they're free).
 */
export function availabilityBadges(rawAvailability: string, busy: Busy[], now = Date.now()) {
  let av: Availability;
  try {
    av = JSON.parse(rawAvailability) as Availability;
  } catch {
    return { freeToday: false, freeWeekend: false };
  }
  if (!Object.values(av).some((s) => s && s.length)) return { freeToday: false, freeWeekend: false };

  const earliest = now + BOOKING_LEAD;
  const today = istMidnight(now);
  const freeToday = hasBlock(freeWindows(av, busy, earliest, today + DAY), HOUR);

  const wd = istWeekday(now); // 5 = Sat, 6 = Sun
  const saturday = wd >= 5 ? today - (wd - 5) * DAY : today + (5 - wd) * DAY;
  const freeWeekend = hasBlock(freeWindows(av, busy, Math.max(earliest, saturday), saturday + 2 * DAY), 2 * HOUR);
  return { freeToday, freeWeekend };
}

/** Busy window lookups for badges only need bookings up to the end of the coming weekend. */
export const BADGE_HORIZON = 9 * DAY;
