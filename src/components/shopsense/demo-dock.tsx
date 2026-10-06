"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, Pause, Play, PlayCircle, RotateCcw, ScanEye, X } from "lucide-react";
import { toast } from "sonner";
import type { DashboardData } from "@/lib/dashboard";
import type { Lang } from "@/lib/domain/types";
import { WEEKDAY_NAMES } from "@/lib/domain/time";
import { tr } from "@/lib/domain/lang";
import { post } from "./use-dashboard";
import { Segmented } from "./header";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 60, 300];

/** The Saturday before `date` (YYYY-MM-DD). */
function lastSaturday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 1) % 7 || 7));
  return base.toISOString().slice(0, 10);
}

/**
 * Everything that exists only because this is a demo (the replay clock, speed,
 * restart, things for judges to try) lives here, folded into one small button,
 * so the owner's screens stay clean.
 */
export function DemoDock({ d, lang, refresh }: { d: DashboardData; lang: Lang; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const t3 = (en: string, ms: string, zh: string) => tr(lang, en, ms, zh);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (d.source !== "sim") return null;
  const replay = d.clock.mode === "replay";

  async function call(url: string, body: object, msg?: [string, string]) {
    const id = msg ? toast.loading(msg[0]) : undefined;
    try {
      await post(url, body);
      if (msg) toast.success(msg[1], { id });
      refresh();
    } catch (err) {
      toast.error((err as Error).message, { id });
    }
  }

  return (
    <div ref={panel} className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="w-[min(340px,calc(100vw-2rem))] origin-bottom-right rounded-2xl border border-border bg-popover p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t3("Demo shop", "Kedai demo", "演示店")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t3("A pretend Ring account. Today replays fast so you can watch a whole day.", "Akaun Ring olok-olok. Hari ini dimainkan laju supaya anda boleh lihat sehari penuh.", "模拟的 Ring 账户。今天会快速回放，让你看完整天。")}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:rotate-90 hover:bg-muted" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums">{d.clock.local}</span>
              <span className="text-xs text-muted-foreground">{WEEKDAY_NAMES[lang][d.clock.weekday]}</span>
              {replay && (
                <button
                  onClick={() => call("/api/clock", { paused: !d.clock.paused })}
                  className="ml-auto grid size-8 place-items-center rounded-full border border-border transition hover:scale-105"
                  aria-label={d.clock.paused ? "Play" : "Pause"}
                >
                  {d.clock.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                </button>
              )}
            </div>
            {replay && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t3("Speed", "Kelajuan", "速度")}</span>
                <Segmented id="speed" value={SPEEDS.includes(d.clock.speed) ? d.clock.speed : 60} options={SPEEDS} onChange={(v) => call("/api/clock", { speed: v, paused: false })} render={(v) => `${v}×`} />
              </div>
            )}

            <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{t3("Try this", "Cuba ini", "试试看")}</p>
            <div className="mt-2 grid gap-1.5">
              <button
                onClick={() => call("/api/demo/reset", { today: lastSaturday(d.clock.date), startAt: 11 * 60 + 30 }, [t3("Loading a Saturday…", "Memuatkan hari Sabtu…", "正在加载星期六…"), t3("Watch around 12:15", "Perhatikan sekitar 12:15", "留意12:15左右")])}
                className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition hover:bg-muted"
              >
                <PlayCircle className="size-4 text-[var(--indigo-11)] transition-transform group-hover:scale-110" />
                <span>
                  {t3("Replay a busy Saturday", "Main semula hari Sabtu yang sibuk", "回放忙碌的星期六")}
                  <span className="block text-[11px] text-muted-foreground">{t3("The produce van arrives in the lunch rush", "Van sayur sampai waktu makan tengah hari", "蔬菜车在午餐高峰时到")}</span>
                </span>
              </button>
              <Link href="/how-it-works" className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition hover:bg-muted">
                <ScanEye className="size-4 text-[var(--indigo-11)] transition-transform group-hover:scale-110" />
                <span>
                  {t3("See what the AI sees", "Lihat apa AI nampak", "看看 AI 看到什么")}
                  <span className="block text-[11px] text-muted-foreground">{t3("Each camera photo and what was read from it", "Setiap gambar kamera dan apa yang dibaca", "每张镜头画面和读到的内容")}</span>
                </span>
              </Link>
              <button
                onClick={() => call("/api/demo/reset", {}, [t3("Restarting…", "Mula semula…", "重新开始…"), t3("Fresh day loaded", "Hari baru dimuatkan", "新的一天已加载")])}
                className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition hover:bg-muted"
              >
                <RotateCcw className="size-4 text-muted-foreground transition-transform group-hover:-rotate-90" />
                {t3("Restart the demo", "Mula semula demo", "重新开始演示")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        className={cn("flex items-center gap-2 rounded-full border border-[var(--indigo-7)] bg-[var(--indigo-3)] px-3.5 py-2 text-xs font-medium text-[var(--indigo-11)] shadow-lg backdrop-blur", open && "bg-[var(--indigo-4)]")}
        aria-expanded={open}
      >
        <FlaskConical className="size-3.5" />
        {t3("Demo", "Demo", "演示")}
        <span className="font-mono tabular-nums text-foreground/80">{d.clock.local}</span>
        {replay && !d.clock.paused && <span className="size-1.5 animate-pulse rounded-full bg-[var(--grass-9)]" />}
      </motion.button>
    </div>
  );
}
