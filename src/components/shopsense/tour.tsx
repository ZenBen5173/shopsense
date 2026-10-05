"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Languages, PlayCircle, Receipt, ScanEye, X } from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "@/lib/domain/types";
import { post } from "./use-dashboard";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/domain/lang";

const KEY = "shopsense:tour";
type TourState = { hidden?: boolean; bm?: boolean; how?: boolean };

function read(): TourState {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}
function write(v: TourState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

/** The Saturday before `date` (YYYY-MM-DD). */
export function lastSaturday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const back = (base.getUTCDay() + 1) % 7 || 7;
  base.setUTCDate(base.getUTCDate() - back);
  return base.toISOString().slice(0, 10);
}

/**
 * Four things to try, for a first-time visitor to the demo (judges included).
 * Each ticks itself off as it happens; the card can be dismissed for good.
 */
export function Tour({
  lang,
  setLang,
  date,
  isSaturday,
  hasSales,
  openSales,
  refresh,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  date: string;
  isSaturday: boolean;
  hasSales: boolean;
  openSales: () => void;
  refresh: () => void;
}) {
  const [state, setState] = useState<TourState | null>(null);
  useEffect(() => setState(read()), []);
  useEffect(() => {
    if (lang !== "en" && state && !state.bm) {
      const next = { ...state, bm: true };
      setState(next);
      write(next);
    }
  }, [lang, state]);

  if (!state || state.hidden) return null;
  const t3 = (en: string, ms: string, zh: string) => tr(lang, en, ms, zh);
  const nextLang: Lang = lang === "en" ? "ms" : lang === "ms" ? "zh" : "en";

  const steps = [
    {
      done: isSaturday,
      icon: PlayCircle,
      label: t3("Replay a Saturday", "Main semula hari Sabtu", "回放星期六"),
      hint: t3("Watch the van arrive in the rush", "Lihat van sampai pada waktu sibuk", "看货车在繁忙时段到来"),
      run: async () => {
        const id = toast.loading(t3("Loading a Saturday…", "Memuatkan hari Sabtu…", "正在加载星期六…"));
        try {
          await post("/api/demo/reset", { today: lastSaturday(date), startAt: 11 * 60 + 30 });
          toast.success(t3("Keep an eye out around 12:15", "Perhatikan sekitar 12:15", "留意12:15左右"), { id });
          refresh();
        } catch (err) {
          toast.error((err as Error).message, { id });
        }
      },
    },
    { done: hasSales, icon: Receipt, label: t3("Close the day", "Tutup hari ini", "今日结算"), hint: t3("Type today's sales", "Masukkan jualan", "输入营业额"), run: openSales },
    { done: !!state.bm, icon: Languages, label: "BM · 中文", hint: t3("Advice in Malay or Chinese", "Nasihat dalam BM atau Cina", "马来文或中文建议"), run: () => setLang(nextLang) },
    { done: !!state.how, icon: ScanEye, label: t3("See what the AI sees", "Lihat apa AI nampak", "看看 AI 看到什么"), hint: t3("Snapshot + JSON", "Gambar + JSON", "画面 + JSON"), href: "/how-it-works" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const cls = "group/step flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-card/60 px-2.5 py-2 transition hover:-translate-y-0.5 hover:border-border";

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-[var(--indigo-6)] bg-[var(--indigo-2)] p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[var(--indigo-11)]">
          {t3("Try these four things", "Cuba empat perkara ini", "试试这四件事")} · {doneCount}/4
        </p>
        <button
          onClick={() => {
            const next = { ...state, hidden: true };
            setState(next);
            write(next);
          }}
          aria-label={t3("Dismiss", "Tutup", "关闭")}
          className="grid size-6 place-items-center rounded-full text-muted-foreground transition hover:rotate-90 hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ol className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const inner = (
            <>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border transition-all duration-300 group-hover/step:scale-110",
                  s.done ? "border-[var(--grass-8)] bg-[var(--grass-4)] text-[var(--grass-11)]" : "border-border bg-card text-muted-foreground",
                )}
              >
                {s.done ? <Check className="size-3.5" /> : <s.icon className="size-3.5" />}
              </span>
              <span className="min-w-0 text-left">
                <span className={cn("block truncate text-sm font-medium", s.done && "text-muted-foreground line-through decoration-[var(--grass-9)]")}>{s.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{s.hint}</span>
              </span>
            </>
          );
          return (
            <motion.li key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}>
              {s.href ? (
                <Link href={s.href} className={cls} onClick={() => write({ ...state, how: true })}>
                  {inner}
                </Link>
              ) : (
                <button onClick={s.run} className={cls}>
                  {inner}
                </button>
              )}
            </motion.li>
          );
        })}
      </ol>
    </motion.section>
  );
}
