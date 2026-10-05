/**
 * Plain-language wording for insights and alerts, in English, Bahasa Melayu
 * and Simplified Chinese. Numbers come from the brains; nothing here invents
 * a figure.
 */

import type { Lang } from "../domain/types";
import { hhmm, hourLabel, WEEKDAY_NAMES } from "../domain/time";
import { tr } from "../domain/lang";
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

/** 上午9点 · 中午12点 · 下午3点 · 晚上7点 */
function hourZh(h: number) {
  const x = ((h % 24) + 24) % 24;
  if (x === 12) return "中午12点";
  if (x === 0) return "午夜12点";
  if (x < 12) return `上午${x}点`;
  return x < 18 ? `下午${x - 12}点` : `晚上${x - 12}点`;
}

export const hourText = (h: number, lang: Lang) => (lang === "ms" ? hourMs(h) : lang === "zh" ? hourZh(h) : hourLabel(h));
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
  const D = day(wd, lang);
  switch (i.kind) {
    case "delivery_in_rush": {
      const sugg = n(f, "suggestHour");
      const sup = s(f, "supplier");
      const at = hhmm(n(f, "arrivalMin"));
      const dur = n(f, "durationMin");
      const cust = n(f, "customersThatHour");
      const qa = n(f, "suggestAvg");
      return {
        title: tr(lang, `${sup} arrives in your ${D} rush`, `${sup} sampai waktu paling sibuk hari ${D}`, `${sup} 在${D}最忙的时候送货`),
        body:
          tr(
            lang,
            `Their vehicle usually pulls up around ${at} on ${D}s and stays ${dur} minutes — inside your busiest hour (about ${cust} customers).`,
            `Kenderaan mereka biasanya sampai sekitar ${at} setiap ${D} dan berada ${dur} minit — dalam jam paling sibuk anda (kira-kira ${cust} pelanggan).`,
            `他们的车通常在${D}${at}左右到，停留${dur}分钟——正好是你最忙的一小时（大约${cust}位顾客）。`,
          ) +
          (sugg >= 0
            ? tr(
                lang,
                ` Ask them to come at ${hourLabel(sugg)} instead, when it's quiet (about ${qa} customers).`,
                ` Minta mereka datang pukul ${hourMs(sugg)}, waktu lebih lengang (kira-kira ${qa} pelanggan).`,
                `请他们改在${hourZh(sugg)}来，那时比较清闲（大约${qa}位顾客）。`,
              )
            : ""),
        action: tr(
          lang,
          `Ask ${sup} to deliver earlier on ${D}s — ${at} lands in your busiest hour.`,
          `Minta ${sup} hantar lebih awal pada hari ${D} — ${at} jatuh dalam jam paling sibuk anda.`,
          `请${sup}在${D}提早送货——${at}正好是你最忙的时候。`,
        ),
      };
    }
    case "late_delivery_sales_dip": {
      const sup = s(f, "supplier");
      const bad = n(f, "badDays");
      const cb = n(f, "convBad");
      const cg = n(f, "convGood");
      const bl = n(f, "buyersLost");
      const sl = n(f, "salesLost");
      return {
        title: tr(lang, `Late ${sup} deliveries cost you ${D} sales`, `${sup} lewat, jualan hari ${D} jatuh`, `${sup}送货迟到，${D}的生意变差`),
        body: tr(
          lang,
          `On the ${bad} ${D}s it came late or not at all, ${cb}% of visitors bought something, against ${cg}% on normal days — about ${bl} fewer buyers, roughly ${cur}${sl} a day. Ask for a firm morning slot, or keep extra stock for ${D}s.`,
          `Pada ${bad} hari ${D} ia lewat atau tidak datang, hanya ${cb}% pengunjung membeli, berbanding ${cg}% pada hari biasa — kira-kira ${bl} pembeli kurang, lebih kurang ${cur}${sl} sehari. Minta slot pagi yang tetap, atau simpan stok lebih untuk hari ${D}.`,
          `在它迟到或没来的${bad}个${D}，只有${cb}%的进店顾客有买东西，平常是${cg}%——少了大约${bl}位买家，一天约${cur}${sl}。请供应商固定早上送货，或在${D}多备点货。`,
        ),
        action: tr(
          lang,
          `Late ${sup} deliveries cost about ${cur}${sl} each ${D} — push for a firm morning slot.`,
          `${sup} yang lewat menelan kira-kira ${cur}${sl} setiap ${D} — minta slot pagi yang tetap.`,
          `${sup}迟到，每个${D}损失约${cur}${sl}——要求固定早上送货。`,
        ),
      };
    }
    case "busy_day_conversion_drop": {
      const cb = n(f, "convBusy");
      const cq = n(f, "convQuiet");
      const ph = n(f, "peakHour");
      const lw = n(f, "salesLostWeek");
      return {
        title: tr(lang, "Busy days convert worse", "Hari sibuk, kurang yang membeli", "越忙的日子，买的人比例越低"),
        body: tr(
          lang,
          `On your busiest days only ${cb}% of visitors buy, versus ${cq}% on quiet days. Queues around ${hourLabel(ph)} may be turning people away — an extra pair of hands then could win back about ${cur}${lw} a week.`,
          `Pada hari paling sibuk hanya ${cb}% pengunjung membeli, berbanding ${cq}% pada hari lengang. Barisan sekitar ${hourMs(ph)} mungkin buat pelanggan pergi — seorang pembantu tambahan boleh pulihkan kira-kira ${cur}${lw} seminggu.`,
          `最忙的日子只有${cb}%的顾客有买，清闲时是${cq}%。${hourZh(ph)}左右排队可能让人走掉——那时多一个人帮忙，每周可挽回约${cur}${lw}。`,
        ),
        action: tr(
          lang,
          `An extra helper around ${hourLabel(ph)} on busy days could win back about ${cur}${lw} a week.`,
          `Pembantu tambahan sekitar ${hourMs(ph)} pada hari sibuk boleh pulihkan kira-kira ${cur}${lw} seminggu.`,
          `忙碌日子在${hourZh(ph)}左右多一个帮手，每周可挽回约${cur}${lw}。`,
        ),
      };
    }
    case "quiet_hour": {
      const h = n(f, "hour");
      const avg = n(f, "avg");
      return {
        title: tr(lang, `Your quietest hour: ${D} ${hourLabel(h)}`, `Waktu paling lengang: ${D}, ${hourMs(h)}`, `最清闲的时段：${D}${hourZh(h)}`),
        body: tr(
          lang,
          `Only about ${avg} customers come in then. A good time to restock shelves, or to try a small promotion that pulls people in.`,
          `Hanya kira-kira ${avg} pelanggan datang pada waktu ini. Masa sesuai untuk susun stok, atau cuba promosi kecil untuk menarik pelanggan.`,
          `那时只有大约${avg}位顾客。适合补货上架，或做个小促销吸引顾客。`,
        ),
        action: tr(
          lang,
          `Use ${D} ${hourLabel(h)}, your quietest hour, to restock.`,
          `Gunakan ${D} ${hourMs(h)}, waktu paling lengang, untuk susun stok.`,
          `利用${D}${hourZh(h)}这个最清闲的时段来补货。`,
        ),
      };
    }
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
  const and = tr(lang, " and ", " dan ", "和");
  const sep = lang === "zh" ? "、" : ", ";
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(sep)}${and}${parts[parts.length - 1]}`;
}
