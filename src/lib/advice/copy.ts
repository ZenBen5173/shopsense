/**
 * Plain-language wording for insights and alerts, in English and Bahasa
 * Melayu. Numbers come from the brains; nothing here invents a figure.
 */

import type { Lang } from "../domain/types";
import { hhmm, hourLabel, WEEKDAY_NAMES } from "../domain/time";
import type { Insight } from "../brains/link";

type F = Record<string, string | number>;
const n = (f: F, k: string) => Number(f[k]);
const s = (f: F, k: string) => String(f[k]);

function hourMs(h: number) {
  const x = ((h % 24) + 24) % 24;
  if (x === 12) return "12 tengah hari";
  if (x === 0) return "12 malam";
  return x < 12 ? `${x} pagi` : x < 19 ? `${x - 12} petang` : `${x - 12} malam`;
}

export const hourText = (h: number, lang: Lang) => (lang === "ms" ? hourMs(h) : hourLabel(h));
const day = (wd: number, lang: Lang) => WEEKDAY_NAMES[lang][wd];

export interface InsightCopy {
  title: string;
  body: string;
  /** One-line version for the advice paragraph. */
  action: string;
}

export function describeInsight(i: Insight, lang: Lang, cur = "RM"): InsightCopy {
  const f = i.facts;
  const wd = n(f, "weekday");
  switch (i.kind) {
    case "delivery_in_rush": {
      const sugg = n(f, "suggestHour");
      if (lang === "ms")
        return {
          title: `${s(f, "supplier")} sampai waktu paling sibuk hari ${day(wd, lang)}`,
          body: `Kenderaan mereka biasanya sampai sekitar ${hhmm(n(f, "arrivalMin"))} setiap ${day(wd, lang)} dan berada ${n(f, "durationMin")} minit — dalam jam paling sibuk anda (kira-kira ${n(f, "customersThatHour")} pelanggan).` +
            (sugg >= 0 ? ` Minta mereka datang pukul ${hourMs(sugg)}, waktu lebih lengang (kira-kira ${n(f, "suggestAvg")} pelanggan).` : ""),
          action: `Minta ${s(f, "supplier")} hantar lebih awal pada hari ${day(wd, lang)} — ${hhmm(n(f, "arrivalMin"))} jatuh dalam jam paling sibuk anda.`,
        };
      return {
        title: `${s(f, "supplier")} arrives in your ${day(wd, lang)} rush`,
        body: `Their vehicle usually pulls up around ${hhmm(n(f, "arrivalMin"))} on ${day(wd, lang)}s and stays ${n(f, "durationMin")} minutes — inside your busiest hour (about ${n(f, "customersThatHour")} customers).` +
          (sugg >= 0 ? ` Ask them to come at ${hourLabel(sugg)} instead, when it's quiet (about ${n(f, "suggestAvg")} customers).` : ""),
        action: `Ask ${s(f, "supplier")} to deliver earlier on ${day(wd, lang)}s — ${hhmm(n(f, "arrivalMin"))} lands in your busiest hour.`,
      };
    }
    case "late_delivery_sales_dip":
      if (lang === "ms")
        return {
          title: `${s(f, "supplier")} lewat, jualan hari ${day(wd, lang)} jatuh`,
          body: `Pada ${n(f, "badDays")} hari ${day(wd, lang)} ia lewat atau tidak datang, hanya ${n(f, "convBad")}% pengunjung membeli, berbanding ${n(f, "convGood")}% pada hari biasa — kira-kira ${n(f, "buyersLost")} pembeli kurang, lebih kurang ${cur}${n(f, "salesLost")} sehari. Minta slot pagi yang tetap, atau simpan stok lebih untuk hari ${day(wd, lang)}.`,
          action: `${s(f, "supplier")} yang lewat menelan kira-kira ${cur}${n(f, "salesLost")} setiap ${day(wd, lang)} — minta slot pagi yang tetap.`,
        };
      return {
        title: `Late ${s(f, "supplier")} deliveries cost you ${day(wd, lang)} sales`,
        body: `On the ${n(f, "badDays")} ${day(wd, lang)}s it came late or not at all, ${n(f, "convBad")}% of visitors bought something, against ${n(f, "convGood")}% on normal days — about ${n(f, "buyersLost")} fewer buyers, roughly ${cur}${n(f, "salesLost")} a day. Ask for a firm morning slot, or keep extra stock for ${day(wd, lang)}s.`,
        action: `Late ${s(f, "supplier")} deliveries cost about ${cur}${n(f, "salesLost")} each ${day(wd, lang)} — push for a firm morning slot.`,
      };
    case "busy_day_conversion_drop":
      if (lang === "ms")
        return {
          title: "Hari sibuk, kurang yang membeli",
          body: `Pada hari paling sibuk hanya ${n(f, "convBusy")}% pengunjung membeli, berbanding ${n(f, "convQuiet")}% pada hari lengang. Barisan sekitar ${hourMs(n(f, "peakHour"))} mungkin buat pelanggan pergi — seorang pembantu tambahan boleh pulihkan kira-kira ${cur}${n(f, "salesLostWeek")} seminggu.`,
          action: `Pembantu tambahan sekitar ${hourMs(n(f, "peakHour"))} pada hari sibuk boleh pulihkan kira-kira ${cur}${n(f, "salesLostWeek")} seminggu.`,
        };
      return {
        title: "Busy days convert worse",
        body: `On your busiest days only ${n(f, "convBusy")}% of visitors buy, versus ${n(f, "convQuiet")}% on quiet days. Queues around ${hourLabel(n(f, "peakHour"))} may be turning people away — an extra pair of hands then could win back about ${cur}${n(f, "salesLostWeek")} a week.`,
        action: `An extra helper around ${hourLabel(n(f, "peakHour"))} on busy days could win back about ${cur}${n(f, "salesLostWeek")} a week.`,
      };
    case "quiet_hour":
      if (lang === "ms")
        return {
          title: `Waktu paling lengang: ${day(wd, lang)}, ${hourMs(n(f, "hour"))}`,
          body: `Hanya kira-kira ${n(f, "avg")} pelanggan datang pada waktu ini. Masa sesuai untuk susun stok, atau cuba promosi kecil untuk menarik pelanggan.`,
          action: `Gunakan ${day(wd, lang)} ${hourMs(n(f, "hour"))}, waktu paling lengang, untuk susun stok.`,
        };
      return {
        title: `Your quietest hour: ${day(wd, lang)} ${hourLabel(n(f, "hour"))}`,
        body: `Only about ${n(f, "avg")} customers come in then. A good time to restock shelves, or to try a small promotion that pulls people in.`,
        action: `Use ${day(wd, lang)} ${hourLabel(n(f, "hour"))}, your quietest hour, to restock.`,
      };
  }
}

/** [12, 13, 18] -> "12pm–2pm and 6pm–7pm". */
export function hourRanges(hours: number[], lang: Lang): string {
  const sorted = [...hours].sort((a, b) => a - b);
  const blocks: [number, number][] = [];
  for (const h of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && h === last[1] + 1) last[1] = h;
    else blocks.push([h, h]);
  }
  const parts = blocks.map(([a, b]) => `${hourText(a, lang)}–${hourText(b + 1, lang)}`);
  const and = lang === "ms" ? " dan " : " and ";
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")}${and}${parts[parts.length - 1]}`;
}
