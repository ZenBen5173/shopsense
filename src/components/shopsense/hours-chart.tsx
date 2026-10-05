"use client";

/**
 * Today vs a usual day, hour by hour. Built on the library's BreathingBars
 * (Living Charts): bars rest at their real value and breathe in a staggered
 * wave; here each bar also carries a ghost of the usual level behind it, busy
 * hours glow amber, and the current hour pulses.
 */
import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { hourText } from "@/lib/advice/copy";
import type { Lang } from "@/lib/domain/types";
import { Spotlight, PanelTitle } from "./spotlight";
import { t } from "./i18n";
import { cn } from "@/lib/utils";

export function HoursChart({
  today,
  typical,
  busy,
  nowHour,
  openAt,
  closeAt,
  lang,
}: {
  today: number[];
  typical: number[];
  busy: number[];
  nowHour: number;
  openAt: number;
  closeAt: number;
  lang: Lang;
}) {
  const c = t(lang);
  const first = Math.floor(openAt / 60);
  const last = Math.min(23, Math.ceil(closeAt / 60) - 1);
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const max = Math.max(1, ...hours.map((h) => Math.max(today[h], typical[h])));

  return (
    <Spotlight className="p-5" glow="rgba(255,197,61,0.10)">
      <PanelTitle
        title={c.hoursTitle}
        right={
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[var(--indigo-9)]" />{c.hoursToday}</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm border border-dashed border-[var(--slate-9)]" />{c.hoursTypical}</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[var(--amber-9)]" />{c.busy}</span>
          </div>
        }
      />
      <TooltipProvider delayDuration={60}>
        <div className="mt-5 flex h-44 items-end gap-1 sm:gap-1.5">
          {hours.map((h, i) => {
            const isBusy = busy.includes(h);
            const isNow = h === nowHour;
            const future = h > nowHour;
            const pct = (today[h] / max) * 100;
            const ghost = (typical[h] / max) * 100;
            const tint = isBusy ? "var(--amber-9)" : "var(--indigo-9)";
            return (
              <Tooltip key={h}>
                <TooltipTrigger asChild>
                  <div className="group/bar relative h-full flex-1 cursor-default">
                    {/* the usual level */}
                    <div
                      className={cn("absolute bottom-0 w-full rounded-t-sm border border-dashed transition-colors", isBusy ? "border-[var(--amber-8)] bg-[var(--amber-3)]/40" : "border-[var(--slate-7)]")}
                      style={{ height: `${ghost}%` }}
                    />
                    {/* today */}
                    {!future && (
                      <motion.div
                        className="absolute bottom-0 w-full rounded-t-sm transition-[filter] group-hover/bar:brightness-125"
                        style={{ background: `linear-gradient(to top, color-mix(in oklab, ${tint} 35%, transparent), ${tint})` }}
                        initial={{ height: 0 }}
                        animate={{ height: [`${pct}%`, `${Math.min(pct + (pct > 0 ? 5 : 0), 100)}%`, `${pct}%`] }}
                        transition={{ height: { duration: 3.2, ease: "easeInOut", repeat: Infinity, delay: i * 0.12 } }}
                      />
                    )}
                    {isNow && (
                      <motion.span
                        className="absolute -top-2 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[var(--indigo-11)]"
                        animate={{ scale: [1, 1.8, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{hourText(h, lang)}{isBusy && <span className="ml-1.5 text-[var(--amber-11)]">· {c.busy}</span>}</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">
                    {c.hoursToday}: {future ? "—" : today[h]} · {c.hoursTypical}: {Math.round(typical[h])}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
      <div className="mt-2 flex gap-1 text-[10px] text-muted-foreground sm:gap-1.5">
        {hours.map((h) => (
          <span key={h} className={cn("flex-1 text-center", h === nowHour && "font-semibold text-foreground", h % 2 && "max-sm:invisible")}>
            {lang === "ms" ? h : hourText(h, lang).replace("am", "a").replace("pm", "p")}
          </span>
        ))}
      </div>
    </Spotlight>
  );
}
