/**
 * Back-door brain: turns back-lane snapshots into a delivery log and checks
 * it against what the owner expects.
 */

import type {
  DeliveryRecord,
  DeliveryVisit,
  ExpectedDelivery,
  StoredEvent,
} from "../domain/types";
import { localParts, weekdayOf } from "../domain/time";

/** Delivery events closer together than this belong to one visit. */
const VISIT_GAP_MIN = 20;
/** Spec rule: late = more than 30 minutes after the window. */
export const LATE_GRACE_MIN = 30;

/** Group back-door delivery events into visits. */
export function buildVisits(events: StoredEvent[]): DeliveryVisit[] {
  const deliveries = events
    .filter((e) => e.role === "back" && e.vision?.kind === "back" && e.vision.isDelivery)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const visits: DeliveryVisit[] = [];
  let cur: { events: StoredEvent[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const first = cur.events[0];
    const last = cur.events[cur.events.length - 1];
    const texts = cur.events
      .map((e) => (e.vision?.kind === "back" ? e.vision.supplierText : null))
      .filter((t): t is string => !!t);
    const vehicles = cur.events
      .map((e) => (e.vision?.kind === "back" ? e.vision.vehicle : null))
      .filter((t): t is string => !!t);
    const mins = (Date.parse(last.occurredAt) - Date.parse(first.occurredAt)) / 60000;
    visits.push({
      eventIds: cur.events.map((e) => e.id),
      arrivedAt: first.occurredAt,
      leftAt: last.occurredAt,
      durationMin: Math.max(1, Math.round(mins)),
      supplierDetected: mostCommon(texts),
      vehicle: mostCommon(vehicles),
    });
    cur = null;
  };
  for (const e of deliveries) {
    if (cur) {
      const prev = cur.events[cur.events.length - 1];
      const gap = (Date.parse(e.occurredAt) - Date.parse(prev.occurredAt)) / 60000;
      if (gap <= VISIT_GAP_MIN) {
        cur.events.push(e);
        continue;
      }
      flush();
    }
    cur = { events: [e] };
  }
  flush();
  return visits;
}

function mostCommon(xs: string[]): string | null {
  if (xs.length === 0) return null;
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1);

/** How well text read off a van matches a supplier name, 0..1. */
export function nameScore(detected: string | null, supplier: string): number {
  if (!detected) return 0;
  const a = new Set(norm(detected));
  const b = norm(supplier);
  if (a.size === 0 || b.length === 0) return 0;
  const STOP = new Set(["sdn", "bhd", "trading", "enterprise", "co", "the"]);
  const keyB = b.filter((w) => !STOP.has(w));
  const hits = keyB.filter((w) => a.has(w)).length;
  return keyB.length ? hits / keyB.length : 0;
}

/**
 * Match one day's visits to that day's expected deliveries.
 * A visit whose logo matches a supplier goes to that supplier; otherwise the
 * nearest unmatched window within 3 hours claims it. Leftover visits are
 * "unexpected"; leftover expectations are missing (window passed) or pending.
 */
export function reconcileDay(
  date: string,
  visits: DeliveryVisit[],
  expected: ExpectedDelivery[],
  tz: string,
  now: Date,
): DeliveryRecord[] {
  const wd = weekdayOf(date);
  const todays = expected.filter((x) => x.weekday === wd);
  const dayVisits = visits.filter((v) => localParts(v.arrivedAt, tz).date === date);
  const nowP = localParts(now, tz);
  const isPast = date < nowP.date;
  const nowMin = isPast ? 24 * 60 : date === nowP.date ? nowP.minuteOfDay : -1;

  const claimed = new Map<number, DeliveryVisit>();
  const used = new Set<DeliveryVisit>();

  // Pass 1: logo matches.
  for (const v of dayVisits) {
    let best: ExpectedDelivery | null = null;
    let bestScore = 0.5;
    for (const x of todays) {
      if (claimed.has(x.id)) continue;
      const s = nameScore(v.supplierDetected, x.supplierName);
      if (s > bestScore) {
        best = x;
        bestScore = s;
      }
    }
    if (best) {
      claimed.set(best.id, v);
      used.add(v);
    }
  }
  // Pass 2: unreadable or half-read vans go to the closest open window.
  const allNames = [...new Set(expected.map((x) => x.supplierName))];
  for (const v of dayVisits) {
    if (used.has(v)) continue;
    // A clearly read logo of a supplier not due today stays "unexpected" rather than filling someone else's window.
    if (allNames.some((n) => nameScore(v.supplierDetected, n) > 0.5)) continue;
    const arr = localParts(v.arrivedAt, tz).minuteOfDay;
    let best: ExpectedDelivery | null = null;
    let bestDist = 180;
    for (const x of todays) {
      if (claimed.has(x.id)) continue;
      const dist = arr < x.windowStart ? x.windowStart - arr : arr > x.windowEnd ? arr - x.windowEnd : 0;
      if (dist < bestDist) {
        best = x;
        bestDist = dist;
      }
    }
    if (best) {
      claimed.set(best.id, v);
      used.add(v);
    }
  }

  const records: DeliveryRecord[] = [];
  for (const x of todays) {
    const v = claimed.get(x.id) ?? null;
    if (v) {
      const arr = localParts(v.arrivedAt, tz).minuteOfDay;
      const lateBy = arr - x.windowEnd;
      const late = lateBy > LATE_GRACE_MIN;
      records.push({ date, expected: x, visit: v, status: late ? "late" : "on_time", lateByMin: lateBy > 0 ? Math.round(lateBy) : null });
    } else {
      // A past day with no visit is missing, even for a window that ends near midnight.
      const overdue = isPast || nowMin > x.windowEnd + LATE_GRACE_MIN;
      records.push({ date, expected: x, visit: null, status: overdue ? "missing" : "pending", lateByMin: null });
    }
  }
  for (const v of dayVisits) {
    if (!used.has(v)) records.push({ date, expected: null, visit: v, status: "unexpected", lateByMin: null });
  }
  return records.sort((a, b) => sortKey(a, tz) - sortKey(b, tz));
}

function sortKey(r: DeliveryRecord, tz: string) {
  if (r.visit) return localParts(r.visit.arrivedAt, tz).minuteOfDay;
  return r.expected?.windowStart ?? 0;
}
