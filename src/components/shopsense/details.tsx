"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ChevronDown, Clock3, PackageCheck, ShoppingBag, Truck, UserCog, UserPlus, Wallet, Cat } from "lucide-react";
import { CursorCard } from "@/components/ui/cursor-card";
import type { DetailsView } from "@/lib/details-view";
import type { Tone } from "@/lib/owner";
import type { Lang } from "@/lib/domain/types";
import { tr } from "@/lib/domain/lang";
import { Spotlight } from "./spotlight";
import { cn } from "@/lib/utils";

const INK: Record<Tone, string> = {
  bad: "text-[var(--red-11)]",
  warn: "text-[var(--amber-11)]",
  good: "text-[var(--grass-11)]",
  calm: "text-[var(--indigo-11)]",
};
const DOT: Record<Tone, string> = {
  bad: "bg-[var(--red-9)]",
  warn: "bg-[var(--amber-9)]",
  good: "bg-[var(--grass-9)]",
  calm: "bg-[var(--indigo-9)]",
};
const PILL: Record<Tone, string> = {
  bad: "border-[var(--red-6)] bg-[var(--red-3)] text-[var(--red-11)]",
  warn: "border-[var(--amber-6)] bg-[var(--amber-3)] text-[var(--amber-11)]",
  good: "border-[var(--grass-6)] bg-[var(--grass-3)] text-[var(--grass-11)]",
  calm: "border-[var(--indigo-6)] bg-[var(--indigo-3)] text-[var(--indigo-11)]",
};

export type DetailsTab = "busy" | "suppliers" | "earn" | "log";

const rise = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
});

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold tracking-tight">{children}</h2>
      {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Four tabs, each one question an owner actually asks. */
export function DetailsTabs({ tab, setTab, lang, problems }: { tab: DetailsTab; setTab: (t: DetailsTab) => void; lang: Lang; problems: number }) {
  const tabs: { id: DetailsTab; icon: typeof Clock3; label: string; badge?: number }[] = [
    { id: "busy", icon: Clock3, label: tr(lang, "Busy times", "Waktu sibuk", "繁忙时段") },
    { id: "suppliers", icon: Truck, label: tr(lang, "Suppliers", "Pembekal", "供应商"), badge: problems || undefined },
    { id: "earn", icon: Wallet, label: tr(lang, "Earn more", "Untung lagi", "多赚钱") },
    { id: "log", icon: Camera, label: tr(lang, "Camera log", "Log kamera", "镜头记录") },
  ];
  return (
    <div className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card p-1">
      {tabs.map((t) => {
        const on = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("group relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-xs font-medium transition-colors sm:flex-row sm:justify-center sm:gap-2 sm:text-sm", on ? "text-background" : "text-muted-foreground hover:text-foreground")}>
            {on && <motion.span layoutId="details-tab" className="absolute inset-0 rounded-xl bg-foreground" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <span className="relative">
              <t.icon className="size-[18px] transition-transform duration-300 group-hover:scale-110" />
              {t.badge && <span className="absolute -right-2 -top-1.5 grid size-4 place-items-center rounded-full bg-[var(--red-9)] text-[9px] font-bold text-white">{t.badge}</span>}
            </span>
            <span className="relative truncate">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Busy */

export function WeekList({ week, lang }: { week: DetailsView["week"]; lang: Lang }) {
  return (
    <motion.section {...rise(2)} className="space-y-3">
      <SectionTitle sub={tr(lang, "A usual week, from the last 4 weeks", "Minggu biasa, dari 4 minggu lepas", "过去4周的平常一周")}>{tr(lang, "Your week", "Minggu anda", "你的一周")}</SectionTitle>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {week.days.map((d, i) => (
          <li key={d.wd} className={cn("group px-4 py-3.5 transition-colors hover:bg-muted/40", d.today && "bg-[var(--indigo-2)]")}>
            <div className="flex items-center justify-between gap-3">
              <p className={cn("text-base font-semibold", d.today && "text-[var(--indigo-11)]")}>
                {d.name}
                {d.today && <span className="ml-2 text-xs font-medium">· {tr(lang, "today", "hari ini", "今天")}</span>}
              </p>
              {d.helper && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--grass-6)] bg-[var(--grass-3)] px-2.5 py-1 text-xs font-medium text-[var(--grass-11)] transition-transform group-hover:scale-105">
                  <UserPlus className="size-3.5" />
                  {tr(lang, "+1 helper", "+1 pembantu", "+1 帮手")}
                </span>
              )}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn("h-full rounded-full", d.top ? "bg-[var(--amber-9)]" : "bg-[var(--indigo-9)]")}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(6, d.share * 100)}%` }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="mt-1.5 text-sm text-foreground/80">
              {d.times}
              <span className="text-muted-foreground"> · {d.total} {tr(lang, "customers", "pelanggan", "位顾客")}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{week.note}</p>
    </motion.section>
  );
}

export function BusyHeadline({ busy }: { busy: DetailsView["busy"] }) {
  return (
    <motion.div {...rise(0)}>
      <Spotlight glow="rgba(255,197,61,0.14)" className="border-[var(--amber-6)] bg-[var(--amber-2)] p-5">
        <p className="font-display text-xl font-semibold leading-snug sm:text-2xl">{busy.headline}</p>
        <p className="mt-1 text-sm text-foreground/70">{busy.sub}</p>
      </Spotlight>
    </motion.div>
  );
}

/* ------------------------------------------------------------- Suppliers */

export function SuppliersPanel({ s, lang }: { s: DetailsView["suppliers"]; lang: Lang }) {
  const [showRecent, setShowRecent] = useState(false);
  if (!s.enabled) {
    return (
      <p className="rounded-2xl border border-border bg-card p-5 text-base text-muted-foreground">
        {tr(lang, "Tag a back-door camera in Settings to start the delivery log.", "Tandakan kamera pintu belakang dalam Tetapan untuk mula log penghantaran.", "请在设置里指定后门镜头，才能开始送货记录。")}
      </p>
    );
  }
  return (
    <div className="space-y-6">
      <motion.section {...rise(0)} className="space-y-3">
        <SectionTitle>{tr(lang, "Today", "Hari ini", "今天")}</SectionTitle>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {s.today.length === 0 && <li className="px-4 py-4 text-muted-foreground">{tr(lang, "No deliveries today", "Tiada penghantaran hari ini", "今天没有送货")}</li>}
          {s.today.map((r) => {
            const row = (
              <li className={cn("group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/40", r.snapshotEventId && "cursor-zoom-in")}>
                <span className={cn("size-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125", DOT[r.tone])} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">{r.supplier}</p>
                  <p className="text-sm text-muted-foreground">{r.time}</p>
                </div>
                {r.snapshotEventId && <Camera className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
                <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium", PILL[r.tone])}>{r.status}</span>
              </li>
            );
            return r.snapshotEventId ? (
              <CursorCard
                key={r.key}
                asChild
                preview={
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/snapshots/${encodeURIComponent(r.snapshotEventId)}`} alt="" className="mb-2 w-full rounded-md" />
                    <p className="text-xs text-neutral-400">{r.detected ? `"${r.detected}"` : r.supplier}</p>
                  </div>
                }
              >
                {row}
              </CursorCard>
            ) : (
              <div key={r.key}>{row}</div>
            );
          })}
        </ul>
      </motion.section>

      <motion.section {...rise(1)} className="space-y-3">
        <SectionTitle sub={tr(lang, "Last 4 weeks", "4 minggu lepas", "过去4周")}>{tr(lang, "Who you can count on", "Siapa yang boleh diharap", "谁靠得住")}</SectionTitle>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {s.record.map((r) => (
            <li key={r.supplier} className="px-4 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-base font-medium">{r.supplier}</p>
                <span className={cn("shrink-0 text-sm font-medium", INK[r.tone])}>{r.word}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {[...Array(r.onTime).fill("good"), ...Array(r.late).fill("warn"), ...Array(r.missing).fill("bad")].map((tone: Tone, i) => (
                  <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.02 * i, type: "spring", stiffness: 500, damping: 25 }} className={cn("size-2.5 rounded-full", DOT[tone])} />
                ))}
                <span className="ml-2 text-sm text-muted-foreground">
                  {tr(lang, `${r.onTime} of ${r.total} on time`, `${r.onTime} daripada ${r.total} tepat masa`, `${r.total} 次中 ${r.onTime} 次准时`)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", DOT.good)} />{tr(lang, "on time", "tepat masa", "准时")}</span>
          <span className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", DOT.warn)} />{tr(lang, "late", "lewat", "迟到")}</span>
          <span className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", DOT.bad)} />{tr(lang, "didn't come", "tidak datang", "没来")}</span>
        </p>
      </motion.section>

      {s.recent.length > 0 && (
        <motion.section {...rise(2)}>
          <button onClick={() => setShowRecent((v) => !v)} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left text-base transition-colors hover:bg-muted/40">
            <span>
              {tr(lang, `${s.recent.length} problems in the last 7 days`, `${s.recent.length} masalah dalam 7 hari lepas`, `过去7天有 ${s.recent.length} 次问题`)}
            </span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showRecent && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showRecent && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                {s.recent.map((r) => (
                  <li key={r.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-20 shrink-0 text-muted-foreground">{r.day}</span>
                    <span className="flex-1 truncate">{r.supplier}</span>
                    <span className={INK[r.tone]}>{r.status}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Earn */

export function EarnPanel({ compare, earn, lang, currency, onSales }: { compare: DetailsView["compare"]; earn: DetailsView["earn"]; lang: Lang; currency: string; onSales: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <motion.section {...rise(0)} className="space-y-3">
        <SectionTitle>{tr(lang, "This week", "Minggu ini", "本周")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Spotlight className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ShoppingBag className="size-4" />{tr(lang, "Customers", "Pelanggan", "顾客")}</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{compare.customers.value}</p>
            <p className={cn("mt-1 text-sm", INK[compare.customers.tone])}>{compare.customers.word}</p>
          </Spotlight>
          <button onClick={onSales} className="rounded-2xl text-left transition-transform hover:-translate-y-0.5">
            <Spotlight glow="rgba(70,167,88,0.16)" className="h-full p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Wallet className="size-4" />{tr(lang, "Who bought", "Yang membeli", "有买的人")}</p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{compare.bought.value}</p>
              <p className={cn("mt-1 text-sm", INK[compare.bought.tone])}>{compare.bought.word}</p>
            </Spotlight>
          </button>
        </div>
      </motion.section>

      <motion.section {...rise(1)} className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <SectionTitle sub={tr(lang, "Found by watching both doors", "Dijumpai dengan memerhati kedua-dua pintu", "同时观察前后门发现的")}>{tr(lang, "Ways to earn more", "Cara untung lagi", "多赚钱的方法")}</SectionTitle>
          {earn.total > 0 && (
            <div className="shrink-0 rounded-xl border border-[var(--amber-6)] bg-[var(--amber-2)] px-3 py-1.5 text-right">
              <p className="font-display text-lg font-semibold tabular-nums text-[var(--amber-11)]">
                {currency}
                {earn.total.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{tr(lang, "a week to win back", "seminggu boleh diselamatkan", "每周可挽回")}</p>
            </div>
          )}
        </div>
        <ul className="space-y-3">
          {earn.items.map((it, i) => {
            const isOpen = open === it.id;
            return (
              <motion.li key={it.id} {...rise(2 + i)}>
                <button onClick={() => setOpen(isOpen ? null : it.id)} className="w-full text-left" aria-expanded={isOpen}>
                  <Spotlight glow={it.tone === "warn" ? "rgba(255,197,61,0.14)" : "rgba(99,102,241,0.12)"} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold leading-snug">{it.action}</p>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden text-sm leading-relaxed text-muted-foreground">
                              <span className="block pt-2">{it.detail}</span>
                            </motion.p>
                          )}
                        </AnimatePresence>
                        {!isOpen && <p className="mt-1 text-xs text-muted-foreground">{tr(lang, "Tap to see why", "Tekan untuk lihat sebab", "点一下看原因")}</p>}
                      </div>
                      {it.money && (
                        <span className="shrink-0 rounded-full border border-[var(--amber-6)] bg-[var(--amber-3)] px-2.5 py-1 text-xs font-semibold text-[var(--amber-11)]">
                          +{currency}
                          {it.money}/{tr(lang, "wk", "mg", "周")}
                        </span>
                      )}
                      <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
                    </div>
                  </Spotlight>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </motion.section>
    </div>
  );
}

/* ------------------------------------------------------------------- Log */

const LOG_ICON = { customer: ShoppingBag, staff: UserCog, delivery: PackageCheck, other: Cat };

export function CameraLog({ log, lang, simNow }: { log: DetailsView["log"]; lang: Lang; simNow: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const shift = Date.now() - Date.parse(simNow);
    const tick = () => setNow(Date.now() - shift);
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [simNow]);
  const ago = (iso: string) => {
    if (now === null) return "";
    const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
    if (m < 1) return tr(lang, "just now", "baru sahaja", "刚刚");
    if (m < 60) return tr(lang, `${m} min ago`, `${m} min lalu`, `${m} 分钟前`);
    const h = Math.floor(m / 60);
    return tr(lang, `${h} h ago`, `${h} jam lalu`, `${h} 小时前`);
  };
  return (
    <motion.section {...rise(0)} className="space-y-3">
      <SectionTitle sub={tr(lang, "What the cameras saw. No faces are kept, only counts.", "Apa kamera nampak. Tiada wajah disimpan, hanya kiraan.", "镜头看到的。不储存人脸，只记录人数。")}>
        {tr(lang, "Camera log", "Log kamera", "镜头记录")}
      </SectionTitle>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {log.length === 0 && <li className="px-4 py-4 text-muted-foreground">{tr(lang, "Nothing yet today", "Belum ada lagi hari ini", "今天还没有")}</li>}
        {log.map((e, i) => {
          const Icon = LOG_ICON[e.kind] ?? Cat;
          return (
            <motion.li key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }} className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base">{e.text}</p>
                <p className="text-xs text-muted-foreground">{e.camera}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{ago(e.at)}</span>
            </motion.li>
          );
        })}
      </ul>
    </motion.section>
  );
}
