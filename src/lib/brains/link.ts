/**
 * The link: insights that need BOTH doors. Neither camera alone can tell an
 * owner that their produce van blocks the back lane during the lunch rush, or
 * that the days the drinks lorry runs late are the days fewer people buy.
 *
 * Each insight carries structured facts; wording happens later (templates or
 * Bedrock), so the numbers are computed once and never invented by a model.
 */

import type { DeliveryRecord, SalesDay } from "../domain/types";
import { localParts, weekdayOf } from "../domain/time";
import { busyProfile, conversion, type DayFootfall } from "./front";

export type InsightKind =
  | "delivery_in_rush"
  | "late_delivery_sales_dip"
  | "busy_day_conversion_drop"
  | "quiet_hour";

export interface Insight {
  id: string;
  kind: InsightKind;
  /** Needs both cameras (the demo's "wow"), or front door only. */
  link: boolean;
  /** Rough ringgit at stake per week; used only to rank. */
  score: number;
  facts: Record<string, string | number>;
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const pct = (x: number) => Math.round(x * 1000) / 10;

export interface LinkInput {
  tz: string;
  history: Map<string, DayFootfall>;
  records: DeliveryRecord[];
  sales: SalesDay[];
  today: string;
  openAt: number;
  closeAt: number;
}

/** A supplier who regularly arrives inside one of that weekday's busy hours. */
export function deliveriesInRush(input: LinkInput): Insight[] {
  const out: Insight[] = [];
  const groups = new Map<string, { supplier: string; weekday: number; arrivals: number[]; durations: number[]; windowStart: number; windowEnd: number }>();
  for (const r of input.records) {
    if (!r.visit || !r.expected || r.date >= input.today) continue;
    const key = `${r.expected.supplierName}|${r.expected.weekday}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { supplier: r.expected.supplierName, weekday: r.expected.weekday, arrivals: [], durations: [], windowStart: r.expected.windowStart, windowEnd: r.expected.windowEnd }));
    g.arrivals.push(localParts(r.visit.arrivedAt, input.tz).minuteOfDay);
    g.durations.push(r.visit.durationMin);
  }
  for (const g of groups.values()) {
    if (g.arrivals.length < 2) continue;
    const arrival = median(g.arrivals);
    const hour = Math.floor(arrival / 60);
    const prof = busyProfile(input.history, g.weekday, input.today);
    if (!prof.busyHours.includes(hour)) continue;
    // Suggest the quietest open hour in the three hours before the window.
    let best = { hour: -1, avg: Infinity };
    for (let h = Math.max(Math.floor(input.openAt / 60), Math.floor(g.windowStart / 60) - 3); h < Math.floor(g.windowStart / 60) + 1; h++) {
      if (prof.busyHours.includes(h)) continue;
      const v = prof.avgByHour[h];
      if (v > 0 && v < best.avg) best = { hour: h, avg: v };
    }
    const hourAvg = prof.avgByHour[hour];
    const duration = Math.round(median(g.durations));
    out.push({
      id: `rush:${g.supplier}:${g.weekday}`,
      kind: "delivery_in_rush",
      link: true,
      score: hourAvg * 3 + duration,
      facts: {
        supplier: g.supplier,
        weekday: g.weekday,
        arrivalMin: Math.round(arrival),
        busyHour: hour,
        customersThatHour: Math.round(hourAvg),
        durationMin: duration,
        suggestHour: best.hour,
        suggestAvg: Number.isFinite(best.avg) ? Math.round(best.avg) : -1,
        samples: g.arrivals.length,
      },
    });
  }
  return out;
}

/** Days a supplier was late or missing vs days it was on time: did fewer visitors buy? */
export function lateDeliverySalesDip(input: LinkInput): Insight[] {
  const out: Insight[] = [];
  const salesBy = new Map(input.sales.map((s) => [s.date, s]));
  const bySupplier = new Map<string, { bad: string[]; good: string[]; weekday: number }>();
  for (const r of input.records) {
    if (!r.expected || r.date >= input.today) continue;
    const key = `${r.expected.supplierName}|${r.expected.weekday}`;
    let g = bySupplier.get(key);
    if (!g) bySupplier.set(key, (g = { bad: [], good: [], weekday: r.expected.weekday }));
    if (r.status === "late" || r.status === "missing") g.bad.push(r.date);
    else if (r.status === "on_time") g.good.push(r.date);
  }
  for (const [key, g] of bySupplier) {
    const supplier = key.split("|")[0];
    const conv = (dates: string[]) => {
      let v = 0;
      let b = 0;
      let rm = 0;
      let n = 0;
      for (const d of dates) {
        const s = salesBy.get(d);
        const f = input.history.get(d)?.total ?? 0;
        if (!s || f === 0) continue;
        v += f;
        b += s.buyerCount;
        rm += s.salesTotal;
        n++;
      }
      return { c: conversion(v, b), visitors: n ? v / n : 0, basket: b ? rm / b : 0, n };
    };
    const bad = conv(g.bad);
    // Compare like with like: on-time days of this supplier, else any day of that weekday.
    let good = conv(g.good);
    if (good.n < 2) {
      const fallback = [...input.history.keys()].filter((d) => d < input.today && weekdayOf(d) === g.weekday && !g.bad.includes(d));
      good = conv(fallback);
    }
    if (bad.n < 2 || good.n < 2 || bad.c === null || good.c === null) continue;
    const drop = good.c - bad.c;
    if (drop < 0.04) continue;
    const buyersLost = drop * bad.visitors;
    const salesLost = buyersLost * (good.basket || 16);
    out.push({
      id: `dip:${supplier}:${g.weekday}`,
      kind: "late_delivery_sales_dip",
      link: true,
      score: salesLost,
      facts: {
        supplier,
        weekday: g.weekday,
        badDays: bad.n,
        convBad: pct(bad.c),
        convGood: pct(good.c),
        buyersLost: Math.round(buyersLost),
        salesLost: Math.round(salesLost),
      },
    });
  }
  return out;
}

/** On the busiest days, does a smaller share of visitors buy? (queues, empty shelves) */
export function busyDayConversionDrop(input: LinkInput): Insight[] {
  const salesBy = new Map(input.sales.map((s) => [s.date, s]));
  const days = [...input.history.values()]
    .filter((d) => d.date < input.today && salesBy.has(d.date) && d.total > 0)
    .map((d) => ({ d, c: salesBy.get(d.date)!.buyerCount / d.total, peak: Math.max(...d.byHour) }));
  if (days.length < 9) return [];
  days.sort((a, b) => b.peak - a.peak);
  const third = Math.floor(days.length / 3);
  const top = days.slice(0, third);
  const bottom = days.slice(-third);
  const avg = (xs: typeof days) => xs.reduce((a, x) => a + x.c, 0) / xs.length;
  const drop = avg(bottom) - avg(top);
  if (drop < 0.03) return [];
  // Which hour is usually the peak on those busy days?
  const peakHours = top.map((x) => x.d.byHour.indexOf(x.peak));
  const hour = Math.round(median(peakHours));
  const wdCounts = new Array(7).fill(0);
  top.forEach((x) => wdCounts[weekdayOf(x.d.date)]++);
  const weekday = wdCounts.indexOf(Math.max(...wdCounts));
  const visitorsTop = top.reduce((a, x) => a + x.d.total, 0) / top.length;
  const salesLost = drop * visitorsTop * 16 * (7 / 3);
  return [{
    id: "busy-conversion",
    kind: "busy_day_conversion_drop",
    link: false,
    score: salesLost,
    facts: { convBusy: pct(avg(top)), convQuiet: pct(avg(bottom)), peakHour: hour, weekday, salesLostWeek: Math.round(salesLost) },
  }];
}

/** The quietest regular hour of the week: a slot for a promo or for restocking. */
export function quietHour(input: LinkInput): Insight[] {
  let best: { wd: number; h: number; v: number } | null = null;
  for (let wd = 0; wd < 7; wd++) {
    const p = busyProfile(input.history, wd, input.today);
    if (p.samples === 0) continue;
    const first = Math.ceil(input.openAt / 60) + 1;
    const last = Math.floor(input.closeAt / 60) - 2;
    for (let h = first; h <= last; h++) {
      const v = p.avgByHour[h];
      if (v > 0 && (!best || v < best.v)) best = { wd, h, v };
    }
  }
  if (!best) return [];
  return [{
    id: "quiet-hour",
    kind: "quiet_hour",
    link: false,
    score: 5,
    facts: { weekday: best.wd, hour: best.h, avg: Math.round(best.v) },
  }];
}

export function allInsights(input: LinkInput): Insight[] {
  return [
    ...deliveriesInRush(input),
    ...lateDeliverySalesDip(input),
    ...busyDayConversionDrop(input),
    ...quietHour(input),
  ].sort((a, b) => Number(b.link) - Number(a.link) || b.score - a.score);
}
