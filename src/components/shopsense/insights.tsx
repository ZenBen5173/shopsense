"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, DoorOpen, Link2, Truck, TrendingDown, Clock3 } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import type { Lang } from "@/lib/domain/types";
import { Spotlight, PanelTitle } from "./spotlight";
import { t } from "./i18n";
import { cn } from "@/lib/utils";

const ICON = {
  delivery_in_rush: Truck,
  late_delivery_sales_dip: TrendingDown,
  busy_day_conversion_drop: DoorOpen,
  quiet_hour: Clock3,
} as const;

export function Insights({ insights, lang }: { insights: DashboardData["insights"]; lang: Lang }) {
  const c = t(lang);
  const [open, setOpen] = useState<string | null>(insights[0]?.id ?? null);

  return (
    <section>
      <PanelTitle title={c.linkTitle} sub={c.linkSub} />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {insights.map((ins, i) => {
          const Icon = ICON[ins.kind];
          const isOpen = open === ins.id;
          return (
            <motion.div
              key={ins.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={cn(ins.link && i < 2 && "md:col-span-1")}
            >
              <Spotlight glow={ins.link ? "rgba(255,197,61,0.16)" : "rgba(99,102,241,0.14)"} className={cn("h-full", ins.link && "border-[var(--amber-6)]")}>
                {ins.link && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--amber-9)] to-transparent [animation:link-glow_3.6s_ease-in-out_infinite]" />
                )}
                <button onClick={() => setOpen(isOpen ? null : ins.id)} className="w-full p-4 text-left" aria-expanded={isOpen}>
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-xl border transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105",
                        ins.link ? "border-[var(--amber-7)] bg-[var(--amber-3)] text-[var(--amber-11)]" : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          ins.link ? "bg-[var(--amber-3)] text-[var(--amber-11)]" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {ins.link ? <Link2 className="size-3" /> : <DoorOpen className="size-3" />}
                        {ins.link ? c.bothCameras : c.frontOnly}
                      </span>
                      <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">{ins.title}</h3>
                    </div>
                    <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden pl-12 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="block pt-2">{ins.body}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </button>
              </Spotlight>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
