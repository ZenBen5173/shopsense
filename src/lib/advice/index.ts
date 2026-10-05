/**
 * The advice generator: two or three plain sentences an owner can act on today.
 *
 * Bedrock writes the words when available; the template writer is the
 * fallback and the safety net. Either way the model only ever sees numbers the
 * brains computed, and is told not to add any of its own.
 */

import { createHash } from "node:crypto";
import type { Db } from "../db/client";
import { getAdvice, putAdvice } from "../db/repo";
import type { DashboardData } from "../dashboard";
import { bedrockConfigured, converse, extractJson, TEXT_MODEL } from "../ai/bedrock";
import { hourRanges, hourText } from "./copy";
import { WEEKDAY_NAMES } from "../domain/time";
import { tr } from "../domain/lang";
import type { Lang } from "../domain/types";

export interface Advice {
  sentences: string[];
  provider: string;
  cached: boolean;
}

/** The compact, model-safe fact sheet the advice is written from. */
export function adviceFacts(d: DashboardData) {
  return {
    shop: d.shop.name,
    currency: d.shop.currency,
    today: WEEKDAY_NAMES.en[d.clock.weekday],
    timeNow: d.clock.local,
    visitorsSoFar: d.today.visitors,
    typicalSoFar: d.today.pace.typical,
    busyHoursToday: d.today.busyHours.map((h) => hourText(h, "en")),
    customersInBusiestHour: Math.round(Math.max(0, ...d.today.typicalByHour)),
    alerts: d.alerts.slice(0, 3).map((a) => a.text),
    topInsights: d.insights.slice(0, 2).map((i) => i.body),
    weekVisitorsChangePct: d.week.visitorsChange === null ? null : Math.round(d.week.visitorsChange * 100),
    conversionThisWeekPct: d.week.conversion === null ? null : Math.round(d.week.conversion * 1000) / 10,
    conversionLastWeekPct: d.week.prevConversion === null ? null : Math.round(d.week.prevConversion * 1000) / 10,
  };
}

/** Hour-level granularity: advice refreshes as the day moves, not on every poll. */
function factsKey(facts: ReturnType<typeof adviceFacts>) {
  const stable = { ...facts, timeNow: facts.timeNow.slice(0, 2), visitorsSoFar: Math.round(facts.visitorsSoFar / 25) };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 24);
}

export function templateAdvice(d: DashboardData, lang: Lang): string[] {
  const out: string[] = [];
  const bad = d.alerts.find((a) => a.tone === "bad" || a.kind === "rush_delivery");
  if (bad) out.push(bad.text);

  const busy = d.today.busyHours;
  if (busy.length) {
    const range = hourRanges(busy, lang);
    const peak = Math.round(Math.max(...busy.map((h) => d.today.typicalByHour[h])));
    const wd = d.clock.weekday;
    out.push(
      tr(
        lang,
        `On ${WEEKDAY_NAMES.en[wd]}s your rush is usually ${range} (up to ${peak} customers an hour) — have two people on the counter then.`,
        `Hari ${WEEKDAY_NAMES.ms[wd]}, waktu paling sibuk biasanya ${range} (sehingga ${peak} pelanggan sejam) — pastikan dua orang di kaunter.`,
        `${WEEKDAY_NAMES.zh[wd]}通常${range}最忙（每小时最多${peak}位顾客）——那时柜台请安排两个人。`,
      ),
    );
  }
  const top = d.insights.find((i) => i.link) ?? d.insights[0];
  if (top) out.push(top.action);
  return out.slice(0, 3);
}

const SYSTEM = (lang: Lang) =>
  [
    "You are a friendly, practical business advisor for the owner of one small neighbourhood shop.",
    "The owner is busy and not technical. Write exactly 2 or 3 short sentences, each one a concrete thing to do or know today.",
    "No jargon (never say 'conversion', 'KPI', 'footfall', 'metrics'). Say 'visitors who bought something' instead.",
    "Use ONLY the numbers in the facts you are given; never invent figures, names or reasons. Prefer the most urgent item first.",
    tr(lang, "Write in simple English.", "Write in simple, natural Bahasa Melayu as spoken in Malaysia.", "Write in simple, natural Simplified Chinese as used by Chinese-Malaysian shopkeepers; keep supplier names as they are."),
    'Reply as JSON: {"sentences": ["...", "..."]}',
  ].join(" ");

async function bedrockAdvice(d: DashboardData, lang: Lang): Promise<string[]> {
  const raw = await converse({
    modelId: TEXT_MODEL,
    system: SYSTEM(lang),
    text: `Facts about the shop right now:\n${JSON.stringify(adviceFacts(d), null, 2)}`,
    maxTokens: 2000,
  });
  const parsed = extractJson(raw) as { sentences?: unknown };
  const sentences = Array.isArray(parsed.sentences) ? parsed.sentences.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : [];
  if (sentences.length < 1) throw new Error("Advice reply had no sentences");
  return sentences.slice(0, 3).map((s) => s.trim());
}

/**
 * Cached advice for these facts, or the template if none is cached yet.
 * `generate` asks Bedrock (when configured) and stores the result.
 */
export async function getAdviceFor(db: Db, d: DashboardData, lang: Lang, generate = false): Promise<Advice> {
  const key = factsKey(adviceFacts(d));
  const hit = await getAdvice(db, key, lang);
  if (hit && !generate) return { sentences: JSON.parse(hit.body), provider: hit.provider, cached: true };
  // Each click on "Ask again" is a paid call: at most one per 15 s per instance.
  const g = globalThis as unknown as { __shopsenseAdviceAt?: number };
  const throttled = Date.now() - (g.__shopsenseAdviceAt ?? 0) < 15_000;
  if (generate && bedrockConfigured() && !throttled) {
    g.__shopsenseAdviceAt = Date.now();
    try {
      const sentences = await bedrockAdvice(d, lang);
      const provider = `bedrock:${TEXT_MODEL}`;
      await putAdvice(db, key, lang, JSON.stringify(sentences), provider);
      return { sentences, provider, cached: false };
    } catch (err) {
      console.warn("[advice] Bedrock failed, using template:", (err as Error).message);
    }
  }
  if (hit) return { sentences: JSON.parse(hit.body), provider: hit.provider, cached: true };
  return { sentences: templateAdvice(d, lang), provider: "template", cached: false };
}
