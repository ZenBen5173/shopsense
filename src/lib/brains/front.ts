/**
 * Front-door brain: footfall, busy hours, conversion.
 * Pure functions over stored events, so they are easy to test and cheap to
 * recompute on every dashboard load.
 */

import type { Confidence, SalesDay, ShopProfile, StoredEvent } from "../domain/types";
import { addDays, localParts, weekdayOf } from "../domain/time";

/** Share of a reported count that might be wrong, by confidence. */
const ERROR_RATE: Record<Confidence, number> = { high: 0.04, medium: 0.15, low: 0.35 };

export interface DayFootfall {
  date: string;
  byHour: number[];
  total: number;
  /** ± this many, from per-event confidence. */
  band: number;
}

/**
 * Customers per hour, per shop-local date. Staff are excluded twice over:
 * the vision step subtracts people in the staff uniform, and anything outside
 * opening hours is treated as staff opening or closing up.
 */
export function footfallByDate(events: StoredEvent[], shop: Pick<ShopProfile, "timezone" | "openAt" | "closeAt">) {
  const days = new Map<string, { byHour: number[]; variance: number }>();
  for (const e of events) {
    if (e.role !== "front" || e.vision?.kind !== "front") continue;
    const p = localParts(e.occurredAt, shop.timezone);
    if (p.minuteOfDay < shop.openAt || p.minuteOfDay > shop.closeAt) continue;
    const c = e.vision.customers;
    if (c <= 0) continue;
    let d = days.get(p.date);
    if (!d) days.set(p.date, (d = { byHour: new Array(24).fill(0), variance: 0 }));
    d.byHour[p.hour] += c;
    const err = c * ERROR_RATE[e.vision.confidence];
    d.variance += err * err + err; // spread grows with both size and doubt
  }
  const out = new Map<string, DayFootfall>();
  for (const [date, d] of days) {
    const total = d.byHour.reduce((a, b) => a + b, 0);
    out.set(date, { date, byHour: d.byHour, total, band: Math.max(1, Math.round(Math.sqrt(d.variance) * 1.6)) });
  }
  return out;
}

export interface BusyProfile {
  weekday: number;
  /** Average customers in each hour, over the history for this weekday. */
  avgByHour: number[];
  /** Hours in the top 20% of this weekday's history. */
  busyHours: number[];
  threshold: number;
  samples: number;
}

/** Busy hour = an open hour in the top 20% of that weekday's history. */
export function busyProfile(history: Map<string, DayFootfall>, weekday: number, excludeDate?: string): BusyProfile {
  const days = [...history.values()].filter((d) => weekdayOf(d.date) === weekday && d.date !== excludeDate);
  const avgByHour = new Array(24).fill(0);
  for (const d of days) d.byHour.forEach((v, h) => (avgByHour[h] += v / days.length));
  const open = avgByHour.map((v, h) => ({ v, h })).filter((x) => x.v > 0.5);
  if (open.length === 0) return { weekday, avgByHour, busyHours: [], threshold: 0, samples: days.length };
  const sorted = [...open].sort((a, b) => b.v - a.v);
  const k = Math.max(1, Math.round(open.length * 0.2));
  const threshold = sorted[k - 1].v;
  const busyHours = open.filter((x) => x.v >= threshold).map((x) => x.h).sort((a, b) => a - b);
  return { weekday, avgByHour: avgByHour.map((v) => Math.round(v * 10) / 10), busyHours, threshold, samples: days.length };
}

/** 7 x 24 average customers per hour, for the week heatmap. */
export function weekHeatmap(history: Map<string, DayFootfall>, excludeDate?: string): number[][] {
  return Array.from({ length: 7 }, (_, wd) => busyProfile(history, wd, excludeDate).avgByHour);
}

/** The single busiest weekday-hour in the history. */
export function peakSlot(heat: number[][]): { weekday: number; hour: number; avg: number } | null {
  let best: { weekday: number; hour: number; avg: number } | null = null;
  heat.forEach((row, wd) => row.forEach((v, h) => {
    if (!best || v > best.avg) best = { weekday: wd, hour: h, avg: v };
  }));
  return best && (best as { avg: number }).avg > 0 ? best : null;
}

export function conversion(visitors: number, buyers: number): number | null {
  if (visitors <= 0 || buyers < 0) return null;
  return Math.min(1, buyers / visitors);
}

export interface WeekCompare {
  visitors: number;
  prevVisitors: number;
  visitorsChange: number | null;
  conversion: number | null;
  prevConversion: number | null;
}

/**
 * Last 7 complete days vs the 7 before. Conversion only uses days where the
 * owner entered sales, on both sides, so a forgotten entry can't fake a drop.
 */
export function weekCompare(history: Map<string, DayFootfall>, sales: SalesDay[], today: string): WeekCompare {
  const salesBy = new Map(sales.map((s) => [s.date, s]));
  const span = (fromBack: number) => {
    let visitors = 0;
    let convVisitors = 0;
    let buyers = 0;
    for (let i = fromBack; i < fromBack + 7; i++) {
      const date = addDays(today, -i);
      const f = history.get(date)?.total ?? 0;
      visitors += f;
      const s = salesBy.get(date);
      if (s && f > 0) {
        convVisitors += f;
        buyers += s.buyerCount;
      }
    }
    return { visitors, conv: conversion(convVisitors, buyers) };
  };
  const cur = span(1);
  const prev = span(8);
  return {
    visitors: cur.visitors,
    prevVisitors: prev.visitors,
    visitorsChange: prev.visitors > 0 ? (cur.visitors - prev.visitors) / prev.visitors : null,
    conversion: cur.conv,
    prevConversion: prev.conv,
  };
}

/** Where today stands against a typical day of the same weekday, up to `untilHour`. */
export function paceVsTypical(today: DayFootfall | undefined, profile: BusyProfile, untilHour: number) {
  const soFar = today ? today.byHour.slice(0, untilHour + 1).reduce((a, b) => a + b, 0) : 0;
  const typical = profile.avgByHour.slice(0, untilHour + 1).reduce((a, b) => a + b, 0);
  return { soFar, typical: Math.round(typical), ratio: typical > 0 ? soFar / typical : null };
}

export interface RotaDay {
  weekday: number;
  /** [startHour, endHourExclusive] blocks that need an extra pair of hands. */
  blocks: [number, number][];
  peak: number;
}

/**
 * A suggested rota: the hours across the whole week busy enough to need a
 * second person at the counter. "Busy enough" is the shop's own top quarter of
 * open hours, but never below `minPerHour` customers, so a quiet shop is not
 * told to hire help it doesn't need.
 */
export function staffingPlan(heat: number[][], openAt: number, closeAt: number, minPerHour = 15): { days: RotaDay[]; extraHours: number; threshold: number } {
  const first = Math.floor(openAt / 60);
  const last = Math.min(23, Math.ceil(closeAt / 60) - 1);
  const values: number[] = [];
  heat.forEach((row) => row.forEach((v, h) => h >= first && h <= last && v > 0 && values.push(v)));
  if (values.length === 0) return { days: [], extraHours: 0, threshold: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const threshold = Math.max(minPerHour, p75);
  let extraHours = 0;
  const days: RotaDay[] = heat.map((row, weekday) => {
    const blocks: [number, number][] = [];
    for (let h = first; h <= last; h++) {
      if (row[h] < threshold) continue;
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock[1] === h) lastBlock[1] = h + 1;
      else blocks.push([h, h + 1]);
      extraHours++;
    }
    return { weekday, blocks, peak: Math.round(Math.max(0, ...row)) };
  });
  return { days, extraHours, threshold: Math.round(threshold) };
}
