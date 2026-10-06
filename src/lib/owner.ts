/**
 * The owner's view: the whole dashboard boiled down to what a busy shop owner
 * can take in at a glance. One thing to do now, three traffic lights, and at
 * most three to-dos. Short words, no percentages, no jargon.
 */

import type { DashboardData } from "./dashboard";
import type { Lang } from "./domain/types";
import { tr } from "./domain/lang";
import { WEEKDAY_NAMES } from "./domain/time";
import { hourRanges, hourText } from "./advice/copy";

export type Tone = "bad" | "warn" | "good" | "calm";

export interface OwnerView {
  greeting: string;
  focus: { tone: Tone; icon: "phone" | "truck" | "users" | "clock" | "sun"; title: string; detail: string };
  customers: { tone: Tone; value: number; word: string };
  deliveries: { tone: Tone; value: string; word: string };
  sales: { tone: Tone; done: boolean; value: string | null; word: string };
  todo: { id: string; text: string }[];
}

export function ownerView(d: DashboardData, lang: Lang): OwnerView {
  const t3 = (en: string, ms: string, zh: string) => tr(lang, en, ms, zh);
  const hour = Math.floor(d.clock.minuteOfDay / 60);
  const rows = d.deliveries.enabled ? d.deliveries.today : [];
  const missing = rows.find((r) => r.status === "missing");
  const late = rows.find((r) => r.status === "late");
  const pending = rows.filter((r) => r.status === "pending");
  const busy = d.today.busyHours;
  const inRush = busy.includes(hour);
  const nextRush = busy.find((h) => h > hour);
  const rushOverlap = pending.find((r) => {
    const [a, b] = (r.window ?? "").split("–").map((x) => Number(x.slice(0, 2)));
    return busy.some((h) => h >= a && h <= b);
  });

  const greeting =
    hour < 12 ? t3("Good morning", "Selamat pagi", "早上好") : hour < 18 ? t3("Good afternoon", "Selamat petang", "下午好") : t3("Good evening", "Selamat malam", "晚上好");

  // 1. The single most useful thing to do right now.
  let focus: OwnerView["focus"];
  if (missing) {
    focus = { tone: "bad", icon: "phone", title: t3(`Call ${missing.supplier}`, `Telefon ${missing.supplier}`, `打电话给 ${missing.supplier}`), detail: t3(`They were due ${missing.window} and haven't come.`, `Dijangka ${missing.window}, belum sampai.`, `原定 ${missing.window} 到，还没来。`) };
  } else if (rushOverlap) {
    focus = { tone: "warn", icon: "truck", title: t3("Keep the back door clear", "Kosongkan pintu belakang", "后门留出空位"), detail: t3(`${rushOverlap.supplier} comes ${rushOverlap.window}, in your busy time.`, `${rushOverlap.supplier} datang ${rushOverlap.window}, waktu sibuk.`, `${rushOverlap.supplier} ${rushOverlap.window} 到，正好是忙的时候。`) };
  } else if (inRush) {
    const n = Math.round(d.today.typicalByHour[hour]);
    focus = { tone: "warn", icon: "users", title: t3("Busy now: 2 people at the counter", "Sibuk sekarang: 2 orang di kaunter", "现在很忙：柜台要两个人"), detail: t3(`About ${n} customers this hour.`, `Kira-kira ${n} pelanggan jam ini.`, `这一小时大约 ${n} 位顾客。`) };
  } else if (nextRush !== undefined) {
    focus = { tone: "calm", icon: "clock", title: t3(`Busy from ${hourText(nextRush, lang)}`, `Sibuk mulai ${hourText(nextRush, lang)}`, `${hourText(nextRush, lang)}开始会忙`), detail: t3("Get a second person ready for the counter.", "Sediakan seorang lagi untuk kaunter.", "先安排好第二个人顾柜台。") };
  } else {
    focus = { tone: "good", icon: "sun", title: t3("All calm", "Semua tenang", "一切平静"), detail: t3("A good time to restock the shelves.", "Masa sesuai untuk susun stok.", "适合补货上架。") };
  }

  // 2. Three traffic lights.
  const r = d.today.pace.ratio;
  const early = d.today.pace.typical < 15 || r === null;
  const customers: OwnerView["customers"] = {
    value: d.today.visitors,
    tone: early ? "calm" : r! >= 1.12 ? "good" : r! <= 0.88 ? "warn" : "calm",
    word: early
      ? t3("Day just started", "Hari baru bermula", "今天刚开始")
      : r! >= 1.12
        ? t3("Busier than usual", "Lebih ramai dari biasa", "比平常多")
        : r! <= 0.88
          ? t3("Quieter than usual", "Kurang dari biasa", "比平常少")
          : t3("A normal day", "Hari biasa", "跟平常差不多"),
  };

  const expectedCount = rows.filter((x) => x.status !== "unexpected").length;
  const arrived = rows.filter((x) => x.status === "on_time" || x.status === "late").length;
  const deliveries: OwnerView["deliveries"] = !d.deliveries.enabled
    ? { tone: "calm", value: "—", word: t3("No back camera", "Tiada kamera belakang", "没有后门镜头") }
    : missing
      ? { tone: "bad", value: `${arrived}/${expectedCount}`, word: t3(`${missing.supplier.split(" ")[0]} hasn't come`, `${missing.supplier.split(" ")[0]} belum sampai`, `${missing.supplier.split(" ")[0]} 还没来`) }
      : late
        ? { tone: "warn", value: `${arrived}/${expectedCount}`, word: t3(`${late.supplier.split(" ")[0]} was late`, `${late.supplier.split(" ")[0]} lewat`, `${late.supplier.split(" ")[0]} 迟到了`) }
        : expectedCount === 0
          ? { tone: "calm", value: "0", word: t3("None today", "Tiada hari ini", "今天没有") }
          : pending.length
            ? { tone: "calm", value: `${arrived}/${expectedCount}`, word: t3(`${pending.length} still coming`, `${pending.length} belum tiba`, `还有 ${pending.length} 个没到`) }
            : { tone: "good", value: `${arrived}/${expectedCount}`, word: t3("All on time", "Semua tepat masa", "全部准时") };

  const s = d.today.sales;
  const sales: OwnerView["sales"] = s
    ? {
        tone: "good",
        done: true,
        value: `${d.shop.currency}${Math.round(s.salesTotal).toLocaleString()}`,
        word:
          d.today.conversion !== null
            ? t3(`${Math.round(d.today.conversion * 10)} in 10 visitors bought`, `${Math.round(d.today.conversion * 10)} dari 10 pengunjung beli`, `每10位顾客有 ${Math.round(d.today.conversion * 10)} 位买`)
            : t3("Saved", "Disimpan", "已保存"),
      }
    : { tone: "calm", done: false, value: null, word: t3("Enter at closing", "Masukkan bila tutup", "打烊时输入") };

  // 3. At most three short to-dos.
  const todo: OwnerView["todo"] = [];
  // Skip the rush happening right now: the big card already says it.
  const current = inRush ? busy.filter((h) => h >= hour).reduce((end, h) => (h === end ? h + 1 : end), hour) : hour;
  const future = busy.filter((h) => h >= current);
  if (future.length) todo.push({ id: `staff-${future[0]}`, text: t3(`2 people at the counter ${hourRanges(future, lang)}`, `2 orang di kaunter ${hourRanges(future, lang)}`, `${hourRanges(future, lang)} 柜台安排两个人`) });
  const top = d.insights.find((i) => i.link && i.facts.weekday === d.clock.weekday) ?? d.insights.find((i) => i.link);
  if (top) {
    const sup = String(top.facts.supplier ?? "");
    const day = WEEKDAY_NAMES[lang][Number(top.facts.weekday)];
    if (top.kind === "delivery_in_rush") todo.push({ id: top.id, text: t3(`Ask ${sup} to come earlier on ${day}s`, `Minta ${sup} datang lebih awal hari ${day}`, `请 ${sup} ${day}早点送货`) });
    else if (top.kind === "late_delivery_sales_dip") todo.push({ id: top.id, text: t3(`Ask ${sup} for a fixed morning time`, `Minta ${sup} tetapkan waktu pagi`, `请 ${sup} 固定早上送货`) });
  }
  if (!s) todo.push({ id: "sales", text: t3("Enter today's sales at closing", "Masukkan jualan hari ini bila tutup", "打烊时输入今日营业额") });

  return { greeting, focus, customers, deliveries, sales, todo: todo.slice(0, 3) };
}
