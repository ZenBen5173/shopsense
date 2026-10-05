"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ChevronDown } from "lucide-react";
import { CursorCard } from "@/components/ui/cursor-card";
import type { DeliveryRow, SupplierScore } from "@/lib/dashboard";
import type { Lang } from "@/lib/domain/types";
import { weekdayOf, weekdayShort } from "@/lib/domain/time";
import { Spotlight, PanelTitle } from "./spotlight";
import { Pill } from "./stat-tiles";
import { t } from "./i18n";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/domain/lang";

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
          {showDay && <span className="mr-1.5 text-muted-foreground">{weekdayShort(weekdayOf(r.date), lang)}</span>}
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
  const t3 = (en: string, ms: string, zh: string) => tr(lang, en, ms, zh);
  if (!rows.length) return null;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{t3("Supplier record · 4 weeks", "Rekod pembekal · 4 minggu", "供应商记录 · 4周")}</p>
      <ul className="mt-2.5 space-y-2.5">
        {rows.map((s, i) => {
          const pct = s.expected ? s.onTime / s.expected : 0;
          const tone = pct >= 0.85 ? "grass" : pct >= 0.6 ? "amber" : "red";
          return (
            <li key={s.supplier} className="group/score">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium">{s.supplier}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {t3(`${s.onTime} of ${s.expected} on time`, `${s.onTime} daripada ${s.expected} tepat masa`, `${s.expected}次中${s.onTime}次准时`)}
                </span>
              </div>
              <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.span className="h-full" style={{ background: "var(--grass-9)" }} initial={{ width: 0 }} animate={{ width: `${(s.onTime / s.expected) * 100}%` }} transition={{ delay: 0.2 + i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                <motion.span className="h-full" style={{ background: "var(--amber-9)" }} initial={{ width: 0 }} animate={{ width: `${(s.late / s.expected) * 100}%` }} transition={{ delay: 0.3 + i * 0.08, duration: 0.8 }} />
                <motion.span className="h-full" style={{ background: "var(--red-9)" }} initial={{ width: 0 }} animate={{ width: `${(s.missing / s.expected) * 100}%` }} transition={{ delay: 0.4 + i * 0.08, duration: 0.8 }} />
              </div>
              {(s.late > 0 || s.missing > 0) && (
                <p className="mt-0.5 max-h-0 overflow-hidden text-[11px] text-muted-foreground opacity-0 transition-all duration-300 group-hover/score:max-h-6 group-hover/score:opacity-100" style={{ color: `var(--${tone}-11)` }}>
                  {s.late > 0 && t3(`${s.late} late`, `${s.late} lewat`, `${s.late}次迟到`) + (s.typicalLateMin ? t3(` (usually +${s.typicalLateMin} min)`, ` (biasanya +${s.typicalLateMin} min)`, `（通常迟${s.typicalLateMin}分钟）`) : "")}
                  {s.late > 0 && s.missing > 0 && " · "}
                  {s.missing > 0 && t3(`${s.missing} no-show`, `${s.missing} tidak datang`, `${s.missing}次没来`)}
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
            {tr(lang, "Tag a back-door camera in ", "Tandakan kamera pintu belakang dalam ", "请在")}
            <a href="/setup" className="text-foreground underline underline-offset-2">{c.setup}</a>
            {tr(lang, " to start the delivery log.", " untuk log penghantaran.", "里设定后门镜头，才能开始送货记录。")}
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
