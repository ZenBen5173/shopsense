"use client";

import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Receipt, Truck, Users, CalendarRange } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { SweepSparkline, SheenRing } from "@/components/ui/living-charts";
import type { DashboardData } from "@/lib/dashboard";
import type { Lang } from "@/lib/domain/types";
import { WEEKDAY_NAMES } from "@/lib/domain/time";
import { Spotlight } from "./spotlight";
import { t } from "./i18n";
import { cn } from "@/lib/utils";

function Tile({ icon: Icon, label, children, delay, glow }: { icon: typeof Users; label: string; children: React.ReactNode; delay: number; glow?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <Spotlight glow={glow} className="h-full p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <Icon className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
          {label}
        </p>
        <div className="mt-2">{children}</div>
      </Spotlight>
    </motion.div>
  );
}

function Change({ value, suffix }: { value: number | null; suffix: string }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", up ? "text-[var(--grass-11)]" : "text-[var(--red-11)]")}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {up ? "+" : ""}
      {pct}% <span className="font-normal text-muted-foreground">{suffix}</span>
    </span>
  );
}

export function StatTiles({ d, lang, onEnterSales }: { d: DashboardData; lang: Lang; onEnterSales: () => void }) {
  const c = t(lang);
  const deliveries = d.deliveries.today;
  const count = (s: string) => deliveries.filter((r) => r.status === s).length;
  const conv = d.today.conversion;
  const paceRatio = d.today.pace.ratio;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile icon={Users} label={c.visitorsToday} delay={0.05}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber value={d.today.visitors} className="font-display text-3xl font-semibold tabular-nums" />
            {d.today.band > 0 && <span className="text-xs text-muted-foreground">±{d.today.band}</span>}
          </div>
          <SweepSparkline
            data={[...d.trend.map((x) => x.visitors), d.today.visitors]}
            className="h-7 w-16 shrink-0 text-[var(--indigo-11)] sm:w-20"
            tooltip={<span>{lang === "ms" ? "14 hari lepas" : "Last 14 days"}</span>}
          />
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {paceRatio !== null && d.today.pace.typical > 0 ? (
            <Change value={paceRatio - 1} suffix={`${c.vsUsual} ${WEEKDAY_NAMES[lang][d.clock.weekday]}`} />
          ) : (
            c.estimate
          )}
        </p>
      </Tile>

      <Tile icon={Receipt} label={c.bought} delay={0.1} glow="rgba(70,167,88,0.16)">
        {conv !== null ? (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-display text-3xl font-semibold tabular-nums">{Math.round(conv * 100)}%</p>
              <button onClick={onEnterSales} className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                {d.shop.currency}
                {d.today.sales?.salesTotal.toLocaleString()} · {d.today.sales?.buyerCount} · {c.editSales}
              </button>
            </div>
            <SheenRing
              size={58}
              stroke={7}
              segments={[
                { label: lang === "ms" ? "Membeli" : "Bought", value: d.today.sales?.buyerCount ?? 0, tint: "var(--grass-9)" },
                { label: lang === "ms" ? "Tengok sahaja" : "Just looked", value: Math.max(0, d.today.visitors - (d.today.sales?.buyerCount ?? 0)), tint: "var(--slate-7)" },
              ]}
              className="[&>ul]:hidden"
            />
          </div>
        ) : (
          <div>
            <p className="font-display text-3xl font-semibold tabular-nums text-muted-foreground">
              {d.week.conversion !== null ? `${Math.round(d.week.conversion * 100)}%` : "—"}
            </p>
            <button
              onClick={onEnterSales}
              className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--grass-7)] bg-[var(--grass-3)] px-2.5 py-0.5 text-xs text-[var(--grass-11)] transition hover:bg-[var(--grass-4)]"
            >
              {c.enterSales} →
            </button>
          </div>
        )}
      </Tile>

      <Tile icon={CalendarRange} label={c.thisWeek} delay={0.15}>
        <AnimatedNumber value={d.week.visitors} className="font-display text-3xl font-semibold tabular-nums" />
        <p className="mt-1">
          <Change value={d.week.visitorsChange} suffix={c.vsLastWeek} />
        </p>
      </Tile>

      <Tile icon={Truck} label={c.deliveriesToday} delay={0.2} glow="rgba(255,197,61,0.14)">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-semibold tabular-nums">{count("on_time") + count("late")}</span>
          <span className="text-sm text-muted-foreground">/ {deliveries.filter((r) => r.status !== "unexpected").length}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {count("late") > 0 && <Pill tone="red">{count("late")} {c.late}</Pill>}
          {count("missing") > 0 && <Pill tone="red">{count("missing")} {c.missing}</Pill>}
          {count("pending") > 0 && <Pill tone="slate">{count("pending")} {c.pending}</Pill>}
          {count("on_time") > 0 && <Pill tone="grass">{count("on_time")} {c.onTime}</Pill>}
        </div>
      </Tile>
    </div>
  );
}

export function Pill({ tone, children }: { tone: "red" | "grass" | "amber" | "slate" | "indigo"; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: `var(--${tone}-3)`,
        borderColor: `var(--${tone}-6)`,
        color: `var(--${tone}-11)`,
      }}
    >
      {children}
    </span>
  );
}
