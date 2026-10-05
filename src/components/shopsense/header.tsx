"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Pause, Play, RotateCcw, Settings2, Info } from "lucide-react";
import { toast } from "sonner";
import type { DashboardData } from "@/lib/dashboard";
import type { Lang } from "@/lib/domain/types";
import { WEEKDAY_NAMES } from "@/lib/domain/time";
import { t } from "./i18n";
import { post } from "./use-dashboard";
import { LANG_LABEL, LANGS, tr } from "@/lib/domain/lang";
import { lastSaturday } from "./tour";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 60, 300];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("relative grid size-8 place-items-center rounded-xl bg-[var(--indigo-9)] text-white shadow-[0_0_24px_-4px_var(--indigo-9)]", className)}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 10l9-6 9 6v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
        <circle cx="12" cy="10.5" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}

function Segmented<T extends string | number>({ value, options, onChange, render }: { value: T; options: T[]; onChange: (v: T) => void; render: (v: T) => React.ReactNode }) {
  return (
    <div className="relative flex rounded-full border border-border bg-muted/50 p-0.5">
      {options.map((o) => (
        <button key={String(o)} onClick={() => onChange(o)} className={cn("relative z-10 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors", value === o ? "text-background" : "text-muted-foreground hover:text-foreground")}>
          {value === o && <motion.span layoutId={`seg-${options.join("-")}`} className="absolute inset-0 -z-10 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function Header({ d, lang, setLang, refresh }: { d: DashboardData; lang: Lang; setLang: (l: Lang) => void; refresh: () => void }) {
  const c = t(lang);
  const replay = d.clock.mode === "replay";

  async function clock(body: object) {
    try {
      await post("/api/clock", body);
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function reset(today?: string) {
    const id = toast.loading(tr(lang, "Loading the demo shop…", "Memuatkan kedai demo…", "正在加载演示店…"));
    try {
      await post("/api/demo/reset", today ? { today, startAt: 11 * 60 + 30 } : {});
      toast.success(tr(lang, "Ready", "Sedia", "好了"), { id });
      refresh();
    } catch (err) {
      toast.error((err as Error).message, { id });
    }
  }

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <Logo className="transition-transform duration-300 group-hover:rotate-[-8deg]" />
          <div className="leading-tight">
            <p className="font-display text-[15px] font-semibold tracking-tight">ShopSense</p>
            <p className="text-[11px] text-muted-foreground">{d.shop.name}</p>
          </div>
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1">
            <span className={cn("size-1.5 rounded-full", replay ? (d.clock.paused ? "bg-[var(--amber-9)]" : "bg-[var(--grass-9)] animate-pulse") : "bg-[var(--red-9)] animate-pulse")} />
            <span className="text-[11px] text-muted-foreground">{replay ? (d.clock.paused ? c.paused : c.replay) : c.liveMode}</span>
            <span className="font-mono text-sm tabular-nums">{d.clock.local}</span>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">{WEEKDAY_NAMES[lang][d.clock.weekday]}</span>
          </div>
          {replay && (
            <>
              <button
                onClick={() => clock({ paused: !d.clock.paused })}
                className="grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:scale-105 hover:text-foreground"
                aria-label={d.clock.paused ? "Play" : "Pause"}
              >
                {d.clock.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              </button>
              <Segmented value={SPEEDS.includes(d.clock.speed) ? d.clock.speed : 60} options={SPEEDS} onChange={(v) => clock({ speed: v, paused: false })} render={(v) => `${v}×`} />
            </>
          )}
          <Segmented value={lang} options={LANGS} onChange={setLang} render={(v) => LANG_LABEL[v]} />
          <Link href="/how-it-works" className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={c.howItWorks}>
            <Info className="size-4" />
          </Link>
          <Link href="/setup" className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:rotate-45 hover:bg-muted hover:text-foreground" aria-label={c.setup}>
            <Settings2 className="size-4" />
          </Link>
        </div>
      </div>
    </header>
      {d.source === "sim" && (
        <div className="border-b border-border/60 bg-[var(--indigo-2)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-[11px] text-muted-foreground sm:px-6">
            <span>
              {c.demoBanner} {d.clock.speed}× · {d.totals.daysOfHistory} {tr(lang, "days of history", "hari sejarah", "天历史")} · {tr(lang, "vision", "penglihatan", "视觉")}:{" "}
              <b className="font-medium text-foreground/80">{d.vision === "bedrock" ? "Amazon Bedrock" : tr(lang, "simulated", "simulasi", "模拟")}</b>
            </span>
            <span className="ml-auto flex gap-3">
              {d.clock.weekday !== 6 && (
                <button onClick={() => reset(lastSaturday(d.clock.date))} className="underline-offset-2 hover:text-foreground hover:underline">
                  {c.replaySaturday}
                </button>
              )}
              <button onClick={() => reset()} className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline">
                <RotateCcw className="size-3" />
                {c.resetDemo}
              </button>
            </span>
          </div>
        </div>
      )}
    </>
  );
}
