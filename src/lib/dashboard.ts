/**
 * Everything the one-screen dashboard shows, computed in one pass from the
 * database. The brains are pure; this file only gathers their inputs.
 */

import type { Db } from "./db/client";
import { countEvents, eventsBetween, getShop, listCameras, listExpected, listSales, recentEvents } from "./db/repo";
import { getClock, nowFrom } from "./clock";
import { getSource } from "./ring";
import { visionMode } from "./vision";
import { addDays, hhmm, localParts, zonedToUtc } from "./domain/time";
import type { DeliveryRecord, Lang, SalesDay, StoredEvent } from "./domain/types";
import { busyProfile, conversion, footfallByDate, paceVsTypical, peakSlot, staffingPlan, weekCompare, weekHeatmap, type RotaDay, type WeekCompare } from "./brains/front";
import { buildVisits, reconcileDay } from "./brains/back";
import { allInsights, weeklyAtStake, type Insight } from "./brains/link";
import { describeInsight, hourText, type InsightCopy } from "./advice/copy";
import { bedrockConfigured } from "./ai/bedrock";

const HISTORY_DAYS = 35;

export interface DeliveryRow {
  key: string;
  date: string;
  supplier: string;
  status: DeliveryRecord["status"];
  window: string | null;
  arrived: string | null;
  durationMin: number | null;
  lateByMin: number | null;
  detected: string | null;
  vehicle: string | null;
  snapshotEventId: string | null;
}

export interface SupplierScore {
  supplier: string;
  expected: number;
  onTime: number;
  late: number;
  missing: number;
  /** Median minutes past the window end, for late arrivals. */
  typicalLateMin: number | null;
}

/** On-time record per supplier over the history window: leverage for the owner. */
export function supplierScorecard(records: DeliveryRecord[], today: string, sinceDate: string): SupplierScore[] {
  const by = new Map<string, SupplierScore & { lates: number[] }>();
  for (const r of records) {
    if (!r.expected || r.date >= today || r.date < sinceDate) continue;
    const name = r.expected.supplierName;
    let s = by.get(name);
    if (!s) by.set(name, (s = { supplier: name, expected: 0, onTime: 0, late: 0, missing: 0, typicalLateMin: null, lates: [] }));
    s.expected++;
    if (r.status === "on_time") s.onTime++;
    if (r.status === "late") {
      s.late++;
      if (r.lateByMin) s.lates.push(r.lateByMin);
    }
    if (r.status === "missing") s.missing++;
  }
  return [...by.values()]
    .map(({ lates, ...s }) => ({ ...s, typicalLateMin: lates.length ? lates.sort((a, b) => a - b)[Math.floor(lates.length / 2)] : null }))
    .sort((a, b) => a.onTime / a.expected - b.onTime / b.expected);
}

export interface FeedItem {
  id: string;
  at: string;
  camera: string;
  role: "front" | "back";
  type: "customer" | "staff" | "left" | "delivery" | "other";
  text: string;
  confidence: string;
  provider: string | null;
}

export interface Alert {
  kind: "late" | "missing" | "rush_delivery" | "pace_up" | "pace_down" | "next_rush";
  tone: "bad" | "warn" | "good" | "info";
  text: string;
}

export interface DashboardData {
  shop: { name: string; currency: string; timezone: string; openAt: number; closeAt: number; staffHint: string };
  lang: Lang;
  source: "sim" | "ring";
  vision: "bedrock" | "offline";
  bedrock: boolean;
  clock: { mode: "live" | "replay"; speed: number; paused: boolean; now: string; local: string; date: string; weekday: number; minuteOfDay: number };
  today: {
    visitors: number;
    band: number;
    byHour: number[];
    typicalByHour: number[];
    busyHours: number[];
    pace: { soFar: number; typical: number; ratio: number | null };
    sales: SalesDay | null;
    conversion: number | null;
  };
  week: WeekCompare;
  trend: { date: string; visitors: number; conversion: number | null }[];
  heatmap: number[][];
  rota: { days: RotaDay[]; extraHours: number; threshold: number };
  peak: { weekday: number; hour: number; avg: number } | null;
  deliveries: { enabled: boolean; today: DeliveryRow[]; recent: DeliveryRow[]; scorecard: SupplierScore[] };
  insights: (Insight & InsightCopy)[];
  atStakeWeek: number;
  alerts: Alert[];
  feed: FeedItem[];
  cameras: { id: string; name: string; role: string; source: string }[];
  totals: { events: number; daysOfHistory: number };
}

function toRow(r: DeliveryRecord, tz: string): DeliveryRow {
  return {
    key: `${r.date}:${r.expected?.id ?? "x"}:${r.visit?.eventIds[0] ?? "none"}`,
    date: r.date,
    supplier: r.expected?.supplierName ?? r.visit?.supplierDetected ?? "Unknown supplier",
    status: r.status,
    window: r.expected ? `${hhmm(r.expected.windowStart)}–${hhmm(r.expected.windowEnd)}` : null,
    arrived: r.visit ? hhmm(localParts(r.visit.arrivedAt, tz).minuteOfDay) : null,
    durationMin: r.visit?.durationMin ?? null,
    lateByMin: r.lateByMin,
    detected: r.visit?.supplierDetected ?? null,
    vehicle: r.visit?.vehicle ?? null,
    snapshotEventId: r.visit?.eventIds[0] ?? null,
  };
}

function feedItem(e: StoredEvent & { cameraName: string }, lang: Lang): FeedItem | null {
  const v = e.vision;
  if (!v) return null;
  const ms = lang === "ms";
  const base = { id: e.id, at: e.occurredAt, camera: e.cameraName, confidence: v.confidence, provider: e.provider };
  if (v.kind === "front") {
    if (e.role !== "front") return null;
    if (v.customers > 0)
      return { ...base, role: "front", type: "customer", text: ms ? `${v.customers} pelanggan masuk` : `${v.customers} customer${v.customers > 1 ? "s" : ""} walked in` };
    if (v.staff > 0) return { ...base, role: "front", type: "staff", text: ms ? `Pekerja masuk` : `Staff came in` };
    if (v.leaving > 0) return { ...base, role: "front", type: "left", text: ms ? `${v.leaving} orang keluar` : `${v.leaving} left` };
    return null;
  }
  if (e.role !== "back") return null;
  if (v.isDelivery)
    return { ...base, role: "back", type: "delivery", text: (ms ? "Penghantaran: " : "Delivery: ") + (v.supplierText ?? v.vehicle ?? (ms ? "pembekal tidak dikenali" : "unreadable van")) };
  return { ...base, role: "back", type: "other", text: v.description };
}

/**
 * Past days never change between refreshes, so keep them in memory and only
 * read today's events from the database each time. The cache key changes when
 * history does (new rows, a demo reset, or a camera re-tagged).
 */
const historyCache = globalThis as unknown as { __shopsenseHistory?: { key: string; events: StoredEvent[] } };

async function historyPlusToday(db: Db, from: Date, dayStart: Date, now: Date, roles: string): Promise<StoredEvent[]> {
  const stamp = await db.query<{ n: unknown; last: unknown }>(
    "SELECT count(*) AS n, max(processed_at) AS last FROM events WHERE occurred_at >= $1 AND occurred_at < $2 AND vision_result IS NOT NULL",
    [from.toISOString(), dayStart.toISOString()],
  );
  const key = `${from.toISOString()}|${dayStart.toISOString()}|${stamp[0]?.n}|${String(stamp[0]?.last)}|${roles}`;
  let past = historyCache.__shopsenseHistory?.key === key ? historyCache.__shopsenseHistory.events : null;
  if (!past) {
    past = await eventsBetween(db, from, new Date(dayStart.getTime() - 1));
    historyCache.__shopsenseHistory = { key, events: past };
  }
  const today = now >= dayStart ? await eventsBetween(db, dayStart, now) : [];
  return past.concat(today);
}

export async function computeDashboard(db: Db, langOverride?: Lang): Promise<DashboardData> {
  const [shop, clock, source, cameras, expected, totalEvents] = await Promise.all([
    getShop(db), getClock(db), getSource(db), listCameras(db), listExpected(db), countEvents(db),
  ]);
  const lang: Lang = langOverride ?? shop.lang;
  const tz = shop.timezone;
  const nowMs = nowFrom(clock);
  const nowD = new Date(nowMs);
  const np = localParts(nowD, tz);
  const today = np.date;
  const from = zonedToUtc(addDays(today, -HISTORY_DAYS), 0, tz);

  const [events, sales, recent] = await Promise.all([
    historyPlusToday(db, from, zonedToUtc(today, 0, tz), nowD, cameras.map((c) => `${c.id}:${c.role}`).join(",")),
    listSales(db, addDays(today, -HISTORY_DAYS), today),
    recentEvents(db, nowD, 40),
  ]);

  const foot = footfallByDate(events, shop);
  const visits = buildVisits(events);
  // Without a back-door camera every expected delivery would look "missing":
  // the delivery brain only runs when one is tagged.
  const hasBack = cameras.some((c) => c.role === "back");
  const records: DeliveryRecord[] = [];
  // Only judge days the back camera was actually watching: before its first
  // event, an expected delivery isn't "missing", we simply weren't looking.
  const firstBack = events.find((e) => e.role === "back");
  const watchFrom = firstBack ? localParts(firstBack.occurredAt, tz).date : today;
  if (hasBack)
    for (let i = HISTORY_DAYS; i >= 0; i--) {
      const date = addDays(today, -i);
      if (date >= watchFrom) records.push(...reconcileDay(date, visits, expected, tz, nowD));
    }
  const todayRecords = records.filter((r) => r.date === today);

  // Front door, today.
  const profile = busyProfile(foot, np.weekday, today);
  const todayFoot = foot.get(today);
  const todaySales = sales.find((s) => s.date === today) ?? null;
  const pace = paceVsTypical(todayFoot, profile, Math.max(0, np.hour - 1));
  const visitors = todayFoot?.total ?? 0;

  // Insights about today's weekday come first: that's what the owner can act on now.
  const relevantToday = (i: Insight) => Number(i.facts.weekday === np.weekday && i.kind !== "quiet_hour");
  const insights = allInsights({ tz, history: foot, records, sales, today, openAt: shop.openAt, closeAt: shop.closeAt })
    .sort((a, b) => relevantToday(b) - relevantToday(a))
    .map((i) => ({
    ...i,
    ...describeInsight(i, lang, shop.currency),
  }));

  // Alerts: what matters in the next few hours.
  const alerts: Alert[] = [];
  const ms = lang === "ms";
  for (const r of todayRecords) {
    if (r.status === "late" && r.expected)
      alerts.push({ kind: "late", tone: "bad", text: ms ? `${r.expected.supplierName} sampai lewat ${r.lateByMin} minit hari ini.` : `${r.expected.supplierName} arrived ${r.lateByMin} min late today.` });
    if (r.status === "missing" && r.expected)
      alerts.push({ kind: "missing", tone: "bad", text: ms ? `${r.expected.supplierName} belum sampai (dijangka ${hhmm(r.expected.windowStart)}–${hhmm(r.expected.windowEnd)}). Telefon mereka.` : `${r.expected.supplierName} hasn't shown up (expected ${hhmm(r.expected.windowStart)}–${hhmm(r.expected.windowEnd)}). Give them a call.` });
    if (r.status === "pending" && r.expected) {
      const overlaps = profile.busyHours.some((h) => h * 60 < r.expected!.windowEnd + 30 && (h + 1) * 60 > r.expected!.windowStart);
      if (overlaps)
        alerts.push({ kind: "rush_delivery", tone: "warn", text: ms ? `${r.expected.supplierName} dijangka ${hhmm(r.expected.windowStart)}–${hhmm(r.expected.windowEnd)}, bertembung dengan waktu sibuk. Sediakan ruang di pintu belakang.` : `${r.expected.supplierName} is due ${hhmm(r.expected.windowStart)}–${hhmm(r.expected.windowEnd)}, overlapping your rush. Keep the back door clear.` });
    }
  }
  const upcoming = profile.busyHours.filter((h) => h >= np.hour);
  if (upcoming.length && np.minuteOfDay >= shop.openAt - 60 && np.minuteOfDay < shop.closeAt) {
    const h = upcoming[0];
    alerts.push({
      kind: "next_rush",
      tone: "info",
      text: h === np.hour
        ? ms ? `Sekarang waktu sibuk — biasanya ${Math.round(profile.avgByHour[h])} pelanggan sejam. Pastikan dua orang di kaunter.` : `You're in a rush hour now — usually ${Math.round(profile.avgByHour[h])} customers an hour. Keep two people on the counter.`
        : ms ? `Waktu sibuk seterusnya: ${hourText(h, lang)} (biasanya ${Math.round(profile.avgByHour[h])} pelanggan).` : `Next rush: ${hourText(h, lang)} (usually ${Math.round(profile.avgByHour[h])} customers).`,
    });
  }
  if (pace.ratio !== null && pace.typical >= 20) {
    const pct = Math.round((pace.ratio - 1) * 100);
    if (pct >= 12) alerts.push({ kind: "pace_up", tone: "good", text: ms ? `${pct}% lebih ramai daripada ${["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"][np.weekday]} biasa setakat ini.` : `${pct}% busier than a usual ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][np.weekday]} so far.` });
    if (pct <= -12) alerts.push({ kind: "pace_down", tone: "warn", text: ms ? `${-pct}% kurang ramai daripada biasa setakat ini.` : `${-pct}% quieter than usual so far.` });
  }
  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  alerts.sort((a, b) => order[a.tone] - order[b.tone]);

  const trend: DashboardData["trend"] = [];
  for (let i = 13; i >= 1; i--) {
    const d = addDays(today, -i);
    const f = foot.get(d)?.total ?? 0;
    const s = sales.find((x) => x.date === d);
    trend.push({ date: d, visitors: f, conversion: s ? conversion(f, s.buyerCount) : null });
  }

  const heatmap = weekHeatmap(foot, today);
  return {
    shop: { name: shop.name, currency: shop.currency, timezone: tz, openAt: shop.openAt, closeAt: shop.closeAt, staffHint: shop.staffHint },
    lang,
    source,
    vision: visionMode(),
    bedrock: bedrockConfigured(),
    clock: {
      mode: clock.mode,
      speed: clock.mode === "replay" ? clock.speed : 1,
      paused: clock.mode === "replay" ? Boolean(clock.paused) : false,
      now: nowD.toISOString(),
      local: hhmm(np.minuteOfDay),
      date: today,
      weekday: np.weekday,
      minuteOfDay: np.minuteOfDay,
    },
    today: {
      visitors,
      band: todayFoot?.band ?? 0,
      byHour: todayFoot?.byHour ?? new Array(24).fill(0),
      typicalByHour: profile.avgByHour,
      busyHours: profile.busyHours,
      pace,
      sales: todaySales,
      conversion: todaySales ? conversion(visitors, todaySales.buyerCount) : null,
    },
    week: weekCompare(foot, sales, today),
    trend,
    heatmap,
    rota: staffingPlan(heatmap, shop.openAt, shop.closeAt),
    peak: peakSlot(heatmap),
    deliveries: {
      enabled: hasBack,
      today: todayRecords.map((r) => toRow(r, tz)),
      recent: records.filter((r) => r.date < today && r.date >= addDays(today, -7)).reverse().map((r) => toRow(r, tz)),
      scorecard: supplierScorecard(records, today, addDays(today, -28)),
    },
    insights,
    atStakeWeek: weeklyAtStake(insights),
    alerts,
    feed: recent.map((e) => feedItem(e, lang)).filter((x): x is FeedItem => !!x && x.type !== "left").slice(0, 14),
    cameras: cameras.map((c) => ({ id: c.id, name: c.name, role: c.role, source: c.source })),
    totals: { events: totalEvents, daysOfHistory: [...foot.keys()].filter((k) => k < today).length },
  };
}
