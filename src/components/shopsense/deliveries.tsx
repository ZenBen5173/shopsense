"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ChevronDown } from "lucide-react";
import { CursorCard } from "@/components/ui/cursor-card";
import type { DeliveryRow, SupplierScore } from "@/lib/dashboard";
import type { Lang } from "@/lib/domain/types";
import { WEEKDAY_NAMES, weekdayOf } from "@/lib/domain/time";
import { Spotlight, PanelTitle } from "./spotlight";
import { Pill } from "./stat-tiles";
import { t } from "./i18n";
import { cn } from "@/lib/utils";

const TONE = { on_time: "grass", late: "red", missing: "red", pending: "slate", unexpected: "amber" } as const;

function Row({ r, lang, showDay }: { r: DeliveryRow; lang: Lang; showDay?: boolean }) {
  const c = t(lang);
  const label = { on_time: c.onTime, late: c.late, missing: c.missing, pending: c.pending, unexpected: c.unexpected }[r.status];
  const body = (
    <li className={cn("group/row flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/60", r.snapshotEventId && "cursor-zoom-in")}>
      <span
        className="size-2 shrink-0 rounded-full transition-transform duration-300 group-hover/row:scale-150"
        style={{ background: `var(--${TONE[r.status]}-9)` }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {showDay && <span className="mr-1.5 text-muted-foreground">{WEEKDAY_NAMES[lang][weekdayOf(r.date)].slice(0, 3)}</span>}
          {r.supplier}
        </p>
        <p className="text-xs text-muted-foreground">
          {r.window && <>{c.window} {r.window}</>}
          {r.arrived && (
            <>
              {r.window && " · "}
              {c.arrived} <span className="tabular-nums text-foreground/80">{r.arrived}</span>
              {r.durationMin ? `, ${c.stayed} ${r.durationMin} ${c.min}` : ""}
            </>
          )}
        </p>
      </div>
      {r.snapshotEventId && <Camera className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />}
      <Pill tone={TONE[r.status]}>
        {label}
        {r.status === "late" && r.lateByMin ? ` +${r.lateByMin}m` : ""}
      </Pill>
    </li>
  );
  if (!r.snapshotEventId) return body;
  return (
    <CursorCard
      asChild
      preview={
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/snapshots/${encodeURIComponent(r.snapshotEventId)}`} alt="" className="mb-2 w-full rounded-md" />
          <p className="text-xs text-neutral-400">
            {r.detected ? `"${r.detected}"` : r.vehicle ?? ""} · {r.arrived}
          </p>
        </div>
      }
    >
      {body}
    </CursorCard>
  );
}

function Scorecard({ rows, lang }: { rows: SupplierScore[]; lang: Lang }) {
  const ms = lang === "ms";
  if (!rows.length) return null;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{ms ? "Rekod pembekal · 4 minggu" : "Supplier record · 4 weeks"}</p>
      <ul className="mt-2.5 space-y-2.5">
        {rows.map((s, i) => {
          const pct = s.expected ? s.onTime / s.expected : 0;
          const tone = pct >= 0.85 ? "grass" : pct >= 0.6 ? "amber" : "red";
          return (
            <li key={s.supplier} className="group/score">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium">{s.supplier}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {ms ? `${s.onTime} daripada ${s.expected} tepat masa` : `${s.onTime} of ${s.expected} on time`}
                </span>
              </div>
              <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.span className="h-full" style={{ background: "var(--grass-9)" }} initial={{ width: 0 }} animate={{ width: `${(s.onTime / s.expected) * 100}%` }} transition={{ delay: 0.2 + i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                <motion.span className="h-full" style={{ background: "var(--amber-9)" }} initial={{ width: 0 }} animate={{ width: `${(s.late / s.expected) * 100}%` }} transition={{ delay: 0.3 + i * 0.08, duration: 0.8 }} />
                <motion.span className="h-full" style={{ background: "var(--red-9)" }} initial={{ width: 0 }} animate={{ width: `${(s.missing / s.expected) * 100}%` }} transition={{ delay: 0.4 + i * 0.08, duration: 0.8 }} />
              </div>
              {(s.late > 0 || s.missing > 0) && (
                <p className="mt-0.5 max-h-0 overflow-hidden text-[11px] text-muted-foreground opacity-0 transition-all duration-300 group-hover/score:max-h-6 group-hover/score:opacity-100" style={{ color: `var(--${tone}-11)` }}>
                  {s.late > 0 && (ms ? `${s.late} lewat` : `${s.late} late`) + (s.typicalLateMin ? (ms ? ` (biasanya +${s.typicalLateMin} min)` : ` (usually +${s.typicalLateMin} min)`) : "")}
                  {s.late > 0 && s.missing > 0 && " · "}
                  {s.missing > 0 && (ms ? `${s.missing} tidak datang` : `${s.missing} no-show`)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Deliveries({ enabled, today, recent, scorecard, lang }: { enabled: boolean; today: DeliveryRow[]; recent: DeliveryRow[]; scorecard: SupplierScore[]; lang: Lang }) {
  const c = t(lang);
  const [showRecent, setShowRecent] = useState(false);
  return (
    <Spotlight className="p-5" glow="rgba(255,197,61,0.10)">
      <PanelTitle title={c.deliveryLog} />
      <ul className="mt-3 -mx-2">
        {!enabled && (
          <li className="px-2 py-3 text-sm text-muted-foreground">
            {lang === "ms" ? "Tandakan kamera pintu belakang dalam " : "Tag a back-door camera in "}
            <a href="/setup" className="text-foreground underline underline-offset-2">{c.setup}</a>
            {lang === "ms" ? " untuk log penghantaran." : " to start the delivery log."}
          </li>
        )}
        {enabled && today.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">{c.noData}</li>}
        {today.map((r) => (
          <Row key={r.key} r={r} lang={lang} />
        ))}
      </ul>
      {recent.length > 0 && (
        <>
          <button
            onClick={() => setShowRecent((v) => !v)}
            className="mt-2 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            {c.last7} · {recent.filter((r) => r.status === "late" || r.status === "missing").length} {c.late}/{c.missing}
            <ChevronDown className={cn("size-3.5 transition-transform", showRecent && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showRecent && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="-mx-2 max-h-80 overflow-y-auto scrollbar-thin"
              >
                {recent.map((r) => (
                  <Row key={r.key} r={r} lang={lang} showDay />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </>
      )}
      <Scorecard rows={scorecard} lang={lang} />
    </Spotlight>
  );
}
