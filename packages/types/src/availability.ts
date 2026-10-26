export type TimeSlot = { from: string; to: string };

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

/** One day's slots sorted, with duplicates and overlapping or touching slots combined (10–18 + 10–20 → 10–20). */
export function mergeSlots(slots: TimeSlot[]): TimeSlot[] {
  const sorted = [...slots].sort((a, b) => mins(a.from) - mins(b.from));
  const out: TimeSlot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && mins(s.from) <= mins(last.to)) {
      if (mins(s.to) > mins(last.to)) last.to = s.to;
    } else out.push({ from: s.from, to: s.to });
  }
  return out;
}

/** A sensible new slot for a day: 10:00–18:00 when empty, else the 2 hours after the latest slot (null if the day is full). */
export function nextSlot(slots: TimeSlot[]): TimeSlot | null {
  if (!slots.length) return { from: '10:00', to: '18:00' };
  const end = Math.max(...slots.map((s) => mins(s.to)));
  const from = end + 60;
  if (from + 60 > 23 * 60 + 30) return null;
  return { from: hhmm(from), to: hhmm(Math.min(from + 120, 23 * 60 + 30)) };
}
