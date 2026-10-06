/**
 * The Details page, in the owner's words. Every number the dashboard computes
 * is turned into a short sentence or a simple count; nothing here needs a
 * legend, a percentage or a ± to understand.
 */

import type { DashboardData } from "./dashboard";
import type { Lang } from "./domain/types";
import type { Tone } from "./owner";
import { tr } from "./domain/lang";
import { WEEKDAY_NAMES, weekdayOf } from "./domain/time";
import { hourRanges, hourText } from "./advice/copy";

export interface DetailsView {
  busy: { headline: string; sub: string };
  week: {
    days: { wd: number; name: string; total: number; share: number; times: string; helper: boolean; today: boolean; top: boolean }[];
    note: string;
  };
  compare: {
    customers: { value: string; word: string; tone: Tone };
    bought: { value: string; word: string; tone: Tone };
  };
  suppliers: {
    enabled: boolean;
    today: { key: string; supplier: string; tone: Tone; status: string; time: string; snapshotEventId: string | null; detected: string | null }[];
    recent: { key: string; day: string; supplier: string; tone: Tone; status: string }[];
    record: { supplier: string; onTime: number; late: number; missing: number; total: number; word: string; tone: Tone }[];
  };
  earn: { total: number; items: { id: string; title: string; action: string; detail: string; money: number | null; tone: Tone }[] };
  log: { id: string; at: string; camera: string; text: string; kind: "customer" | "staff" | "delivery" | "other" }[];
}

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function detailsView(d: DashboardData, lang: Lang): DetailsView {
  const t3 = (en: string, ms: string, zh: string) => tr(lang, en, ms, zh);
  const wdName = (wd: number) => WEEKDAY_NAMES[lang][wd];

  // Busy times today.
  const busyNow = d.today.busyHours;
  const peak = Math.round(Math.max(0, ...busyNow.map((h) => d.today.typicalByHour[h])));
  const busy = busyNow.length
    ? {
        headline: t3(`Busiest today: ${hourRanges(busyNow, lang)}`, `Paling sibuk hari ini: ${hourRanges(busyNow, lang)}`, `今天最忙：${hourRanges(busyNow, lang)}`),
        sub: t3(`Up to ${peak} customers an hour on a usual ${wdName(d.clock.weekday)}.`, `Sehingga ${peak} pelanggan sejam pada ${wdName(d.clock.weekday)} biasa.`, `平常的${wdName(d.clock.weekday)}每小时最多 ${peak} 位顾客。`),
      }
    : { headline: t3("No clear rush today", "Tiada waktu sibuk yang jelas", "今天没有明显的高峰"), sub: t3("Customers come in evenly.", "Pelanggan datang sekata.", "顾客来得很平均。") };

  // The week, one row per day: how busy, when, and whether to add a helper.
  const totals = d.heatmap.map((row) => Math.round(row.reduce((a, b) => a + b, 0)));
  const max = Math.max(1, ...totals);
  const topWd = totals.indexOf(max);
  const days = ORDER.map((wd) => {
    const blocks = d.rota.days[wd]?.blocks ?? [];
    const hours = blocks.flatMap(([a, b]) => Array.from({ length: b - a }, (_, k) => a + k));
    return {
      wd,
      name: wdName(wd),
      total: totals[wd] ?? 0,
      share: (totals[wd] ?? 0) / max,
      times: hours.length ? hourRanges(hours, lang) : t3("Steady all day", "Sekata sepanjang hari", "全天平稳"),
      helper: hours.length > 0,
      today: wd === d.clock.weekday,
      top: wd === topWd,
    };
  });
  const week = {
    days,
    note:
      d.rota.extraHours > 0
        ? t3(
            `About ${d.rota.extraHours} hours of extra help a week covers every rush.`,
            `Kira-kira ${d.rota.extraHours} jam bantuan tambahan seminggu cukup untuk semua waktu sibuk.`,
            `每周大约 ${d.rota.extraHours} 小时的额外帮手就能应付所有高峰。`,
          )
        : t3("One person can run the shop all week.", "Seorang boleh jaga kedai sepanjang minggu.", "整个星期一个人就够了。"),
  };

  // This week vs last week, in words.
  const ch = d.week.visitorsChange;
  const customers = {
    value: d.week.visitors.toLocaleString(),
    tone: (ch === null ? "calm" : ch >= 0.05 ? "good" : ch <= -0.05 ? "warn" : "calm") as Tone,
    word:
      ch === null
        ? t3("First week", "Minggu pertama", "第一周")
        : ch >= 0.05
          ? t3("More than last week", "Lebih dari minggu lepas", "比上周多")
          : ch <= -0.05
            ? t3("Fewer than last week", "Kurang dari minggu lepas", "比上周少")
            : t3("About the same as last week", "Lebih kurang sama dengan minggu lepas", "跟上周差不多"),
  };
  const c = d.week.conversion;
  const p = d.week.prevConversion;
  const in10 = (x: number) => Math.round(x * 10);
  const bought = {
    value: c === null ? "—" : t3(`${in10(c)} in 10`, `${in10(c)} dari 10`, `10 中 ${in10(c)}`),
    tone: (c === null || p === null ? "calm" : in10(c) > in10(p) ? "good" : in10(c) < in10(p) ? "warn" : "calm") as Tone,
    word:
      c === null
        ? t3("Enter sales to see this", "Masukkan jualan untuk lihat", "输入营业额才能看到")
        : p === null
          ? t3("visitors bought something", "pengunjung membeli", "位顾客有买东西")
          : in10(c) === in10(p)
            ? t3("bought something, same as last week", "membeli, sama seperti minggu lepas", "有买东西，跟上周一样")
            : t3(`bought something (last week ${in10(p)} in 10)`, `membeli (minggu lepas ${in10(p)} dari 10)`, `有买东西（上周 10 中 ${in10(p)}）`),
  };

  // Suppliers.
  const statusWord = (s: string) =>
    ({
      on_time: t3("On time", "Tepat masa", "准时"),
      late: t3("Late", "Lewat", "迟到"),
      missing: t3("Didn't come", "Tidak datang", "没来"),
      pending: t3("Still coming", "Belum tiba", "还没到"),
      unexpected: t3("Not on your list", "Tiada dalam senarai", "不在名单上"),
    })[s] ?? s;
  const toneOf = (s: string): Tone => (s === "on_time" ? "good" : s === "late" || s === "unexpected" ? "warn" : s === "missing" ? "bad" : "calm");
  const suppliers = {
    enabled: d.deliveries.enabled,
    today: d.deliveries.today.map((r) => ({
      key: r.key,
      supplier: r.supplier,
      tone: toneOf(r.status),
      status: statusWord(r.status) + (r.status === "late" && r.lateByMin ? t3(` by ${r.lateByMin} min`, ` ${r.lateByMin} min`, ` ${r.lateByMin} 分钟`) : ""),
      time: r.arrived ? t3(`Came ${r.arrived}`, `Sampai ${r.arrived}`, `${r.arrived} 到`) : r.window ? t3(`Due ${r.window}`, `Dijangka ${r.window}`, `预计 ${r.window}`) : "",
      snapshotEventId: r.snapshotEventId,
      detected: r.detected,
    })),
    recent: d.deliveries.recent
      .filter((r) => r.status === "late" || r.status === "missing")
      .map((r) => ({ key: r.key, day: wdName(weekdayOf(r.date)), supplier: r.supplier, tone: toneOf(r.status), status: statusWord(r.status) })),
    record: d.deliveries.scorecard.map((s) => {
      const ratio = s.expected ? s.onTime / s.expected : 1;
      const tone: Tone = ratio >= 0.85 ? "good" : ratio >= 0.6 ? "warn" : "bad";
      return {
        supplier: s.supplier,
        onTime: s.onTime,
        late: s.late,
        missing: s.missing,
        total: s.expected,
        tone,
        word: tone === "good" ? t3("Reliable", "Boleh harap", "可靠") : tone === "warn" ? t3("Sometimes late", "Kadang-kadang lewat", "有时迟到") : t3("Often lets you down", "Selalu mengecewakan", "经常出问题"),
      };
    }),
  };

  // Ways to earn more: the insights as one-line actions with the money attached.
  const earn = {
    total: d.atStakeWeek,
    items: d.insights.map((i) => {
      const money = Number(i.facts.weeklyAtStake) || null;
      const sup = String(i.facts.supplier ?? "");
      const day = wdName(Number(i.facts.weekday));
      const hr = hourText(Number(i.facts.peakHour ?? i.facts.hour ?? 0), lang);
      const short =
        i.kind === "delivery_in_rush"
          ? t3(`Ask ${sup} to come earlier on ${day}s`, `Minta ${sup} datang lebih awal hari ${day}`, `请 ${sup} ${day}早点送货`)
          : i.kind === "late_delivery_sales_dip"
            ? t3(`Ask ${sup} for a fixed morning time`, `Minta ${sup} tetapkan waktu pagi`, `请 ${sup} 固定早上送货`)
            : i.kind === "busy_day_conversion_drop"
              ? t3(`Add a helper around ${hr} on busy days`, `Tambah pembantu sekitar ${hr} pada hari sibuk`, `忙碌日子在${hr}左右加一个帮手`)
              : t3(`Restock on ${day} at ${hr}, your quietest time`, `Susun stok hari ${day} pukul ${hr}, waktu paling lengang`, `${day}${hr}最清闲，适合补货`);
      return {
        id: i.id,
        title: i.title,
        action: short,
        detail: i.body,
        money,
        tone: (i.link ? "warn" : "calm") as Tone,
      };
    }),
  };

  const log = d.feed
    .filter((f) => f.type !== "left")
    .slice(0, 10)
    .map((f) => ({ id: f.id, at: f.at, camera: f.camera, text: f.text, kind: f.type as DetailsView["log"][number]["kind"] }));

  return { busy, week, compare: { customers, bought }, suppliers, earn, log };
}
