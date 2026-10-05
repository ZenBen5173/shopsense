/**
 * Shop-local time helpers. All bucketing (hour of day, weekday, date) happens
 * in the shop's own timezone, never the server's, because a Vercel function
 * runs in UTC and "lunch" means lunch in Kuala Lumpur.
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface LocalParts {
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  /** Minutes after local midnight. */
  minuteOfDay: number;
}

export function localParts(instant: Date | string | number, tz: string): LocalParts {
  const d = instant instanceof Date ? instant : new Date(instant);
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(d)) parts[p.type] = p.value;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    year,
    month,
    day,
    hour,
    minute,
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    minuteOfDay: hour * 60 + minute,
  };
}

/** Offset of `tz` from UTC at `instant`, in minutes (KL = +480). */
function offsetMinutes(instant: number, tz: string) {
  const p = localParts(instant, tz);
  const sec = Number(
    formatter(tz)
      .formatToParts(new Date(instant))
      .find((x) => x.type === "second")?.value ?? 0,
  );
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, sec);
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60000);
}

/** The UTC instant for a local date + minutes-after-midnight in `tz`. */
export function zonedToUtc(date: string, minuteOfDay: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0) + minuteOfDay * 60000;
  // Two passes settle DST edges; KL has none but the helper stays honest.
  let guess = naive - offsetMinutes(naive, tz) * 60000;
  guess = naive - offsetMinutes(guess, tz) * 60000;
  return new Date(guess);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function hhmm(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = Math.round(minuteOfDay % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "12pm", "1pm" — how a shop owner says an hour. */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

export const WEEKDAY_NAMES = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ms: ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"],
} as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
