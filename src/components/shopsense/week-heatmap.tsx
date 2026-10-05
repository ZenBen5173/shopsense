"use client";

/**
 * The week as a grid of hours. No heatmap exists in the component library, so
 * this one borrows the Highlight Grid idea: a single highlight glides to
 * whichever cell you point at (shared layoutId), with a readout that follows.
 */
import { useState } from "react";
import { motion } from "motion/react";
import { hourText } from "@/lib/advice/copy";
import { WEEKDAY_NAMES } from "@/lib/domain/time";
import type { Lang } from "@/lib/domain/types";
import { Spotlight, PanelTitle } from "./spotlight";
import { t } from "./i18n";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first, as shop weeks run

export function WeekHeatmap({ heat, openAt, closeAt, todayWd, lang }: { heat: number[][]; openAt: number; closeAt: number; todayWd: number; lang: Lang }) {
  const c = t(lang);
  const first = Math.floor(openAt / 60);
  const last = Math.min(23, Math.ceil(closeAt / 60) - 1);
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const max = Math.max(1, ...heat.flat());
  const [hover, setHover] = useState<{ wd: number; h: number } | null>(null);
  const peak = (() => {
    let best = { wd: 0, h: 0, v: -1 };
    heat.forEach((row, wd) => row.forEach((v, h) => v > best.v && (best = { wd, h, v })));
    return best;
  })();
  const shown = hover ?? { wd: peak.wd, h: peak.h };

  return (
    <Spotlight className="p-5">
      <PanelTitle
        title={c.heatTitle}
        sub={c.heatSub}
        right={
          <div className="text-right">
            <p className="font-display text-lg font-semibold tabular-nums">{Math.round(heat[shown.wd]?.[shown.h] ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">
              {WEEKDAY_NAMES[lang][shown.wd].slice(0, 3)} {hourText(shown.h, lang)}
            </p>
          </div>
        }
      />
      <div className="mt-4 overflow-x-auto scrollbar-thin" onMouseLeave={() => setHover(null)}>
        <div className="min-w-[420px]">
          {ORDER.map((wd) => (
            <div key={wd} className="flex items-center gap-1 py-[2px]">
              <span className={`w-9 shrink-0 text-[10px] ${wd === todayWd ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {WEEKDAY_NAMES[lang][wd].slice(0, 3)}
              </span>
              {hours.map((h) => {
                const v = heat[wd]?.[h] ?? 0;
                const a = v / max;
                const active = shown.wd === wd && shown.h === h;
                return (
                  <div key={h} className="relative h-5 flex-1" onMouseEnter={() => setHover({ wd, h })}>
                    <div
                      className="absolute inset-[1px] rounded-[3px] transition-transform duration-200 hover:scale-110"
                      style={{
                        background: a > 0.78 ? `color-mix(in oklab, var(--amber-9) ${40 + a * 60}%, transparent)` : `color-mix(in oklab, var(--indigo-9) ${8 + a * 80}%, var(--slate-3))`,
                      }}
                    />
                    {active && (
                      <motion.div
                        layoutId="heat-highlight"
                        className="pointer-events-none absolute -inset-[1px] rounded-[4px] ring-2 ring-foreground/80"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="mt-1 flex gap-1 pl-10 text-[9px] text-muted-foreground">
            {hours.map((h) => (
              <span key={h} className="flex-1 text-center">{h % 3 === 0 ? h : ""}</span>
            ))}
          </div>
        </div>
      </div>
    </Spotlight>
  );
}
