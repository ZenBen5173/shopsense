"use client";

import { motion } from "motion/react";
import { UsersRound } from "lucide-react";
import type { RotaDay } from "@/lib/brains/front";
import type { Lang } from "@/lib/domain/types";
import { weekdayShort } from "@/lib/domain/time";
import { hourRanges } from "@/lib/advice/copy";
import { Spotlight, PanelTitle } from "./spotlight";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/domain/lang";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** When a second person should be at the counter, drawn as a week of opening-hour bars. */
export function StaffingPlan({
  rota,
  openAt,
  closeAt,
  todayWd,
  lang,
}: {
  rota: { days: RotaDay[]; extraHours: number; threshold: number };
  openAt: number;
  closeAt: number;
  todayWd: number;
  lang: Lang;
}) {
  const t3 = (en: string, ms: string, zh: string) => tr(lang, en, ms, zh);
  const first = Math.floor(openAt / 60);
  const span = Math.max(1, Math.ceil(closeAt / 60) - first);
  return (
    <Spotlight className="h-full p-5" glow="rgba(70,167,88,0.14)">
      <PanelTitle
        title={t3("Suggested staff rota", "Cadangan jadual pekerja", "建议排班")}
        sub={t3(
          `A second person at the counter when it's over ${rota.threshold} customers an hour`,
          `Tambah seorang di kaunter bila lebih ${rota.threshold} pelanggan sejam`,
          `每小时超过${rota.threshold}位顾客时，柜台多安排一个人`,
        )}
        right={<UsersRound className="size-4 text-[var(--grass-11)]" />}
      />
      {rota.extraHours === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t3("One person is enough all week.", "Satu orang sudah cukup sepanjang minggu.", "整个星期一个人就够了。")}</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {ORDER.map((wd, i) => {
              const day = rota.days[wd];
              if (!day) return null;
              const hours = day.blocks.flatMap(([a, b]) => Array.from({ length: b - a }, (_, k) => a + k));
              return (
                <li key={wd} className="group/rota grid grid-cols-[2.5rem_1fr] items-center gap-2">
                  <span className={cn("text-[11px]", wd === todayWd ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {weekdayShort(wd, lang)}
                  </span>
                  <div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                      {day.blocks.map(([a, b]) => (
                        <motion.span
                          key={a}
                          className="absolute inset-y-0 rounded-full bg-[var(--grass-9)] transition-[filter] group-hover/rota:brightness-125"
                          style={{ left: `${((a - first) / span) * 100}%` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${((b - a) / span) * 100}%` }}
                          transition={{ delay: 0.15 + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        />
                      ))}
                    </div>
                    <p className="mt-0.5 h-4 text-[10px] text-muted-foreground">{hours.length ? hourRanges(hours, lang) : t3("one is enough", "seorang cukup", "一人就够")}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            {lang === "ms" ? (
              <>Kira-kira <b className="text-foreground">{rota.extraHours} jam</b> bantuan tambahan seminggu, hanya pada waktu sibuk.</>
            ) : lang === "zh" ? (
              <>每周大约需要 <b className="text-foreground">{rota.extraHours} 小时</b>的额外帮手，只在忙的时候。</>
            ) : (
              <>About <b className="text-foreground">{rota.extraHours} hours</b> of extra help a week, only when it&apos;s busy.</>
            )}
          </p>
        </>
      )}
    </Spotlight>
  );
}
