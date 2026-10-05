"use client";

import { useEffect, useState } from "react";
import { MathCurveLoader } from "@/components/ui/math-curve-loader";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import { Header } from "@/components/shopsense/header";
import { AdviceCard } from "@/components/shopsense/advice-card";
import { StatTiles } from "@/components/shopsense/stat-tiles";
import { HoursChart } from "@/components/shopsense/hours-chart";
import { WeekHeatmap } from "@/components/shopsense/week-heatmap";
import { StaffingPlan } from "@/components/shopsense/staffing-plan";
import { Tour } from "@/components/shopsense/tour";
import { Insights } from "@/components/shopsense/insights";
import { Deliveries } from "@/components/shopsense/deliveries";
import { LiveFeed } from "@/components/shopsense/live-feed";
import { SalesDialog } from "@/components/shopsense/sales-dialog";
import { useDashboard } from "@/components/shopsense/use-dashboard";
import { t } from "@/components/shopsense/i18n";
import type { Lang } from "@/lib/domain/types";
import { WEEKDAY_NAMES } from "@/lib/domain/time";

export default function Dashboard() {
  const [lang, setLang] = useState<Lang | null>(null);
  const { data, error, refresh, setData } = useDashboard(lang);
  const [salesOpen, setSalesOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("shopsense:lang");
      if (saved === "en" || saved === "ms") setLang(saved);
    } catch {}
  }, []);

  const chooseLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("shopsense:lang", l);
    } catch {}
  };

  if (!data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <MathCurveLoader curve="rose" size={64} className="text-[var(--indigo-11)]" label="Loading ShopSense" />
          <FlipFadeText words={t(lang ?? "en").loading} className="min-h-0 py-2" textClassName="text-sm md:text-sm normal-case font-medium tracking-wide whitespace-pre text-muted-foreground dark:text-muted-foreground" interval={1800} />
          {error && <p className="max-w-sm text-sm text-[var(--red-11)]">{error}</p>}
        </div>
      </main>
    );
  }

  const L = lang ?? data.lang;

  return (
    <div className="min-h-dvh bg-background">
      <Header d={data} lang={L} setLang={chooseLang} refresh={refresh} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {error && <p className="rounded-lg border border-[var(--red-6)] bg-[var(--red-3)] px-3 py-2 text-sm text-[var(--red-11)]">{error}</p>}
        {data.source === "sim" && (
          <Tour
            lang={L}
            setLang={chooseLang}
            date={data.clock.date}
            isSaturday={data.clock.weekday === 6}
            hasSales={!!data.today.sales}
            openSales={() => setSalesOpen(true)}
            refresh={refresh}
          />
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-5">
            <AdviceCard
              advice={data.advice}
              alerts={data.alerts}
              lang={L}
              onAdvice={(advice) => setData({ ...data, advice })}
              shopName={data.shop.name}
              dateLabel={`${WEEKDAY_NAMES[L][data.clock.weekday]} ${data.clock.date.slice(8)}/${data.clock.date.slice(5, 7)}`}
              visitors={data.today.visitors}
            />
            <StatTiles d={data} lang={L} onEnterSales={() => setSalesOpen(true)} />
            <HoursChart
              today={data.today.byHour}
              typical={data.today.typicalByHour}
              busy={data.today.busyHours}
              nowHour={Math.floor(data.clock.minuteOfDay / 60)}
              openAt={data.shop.openAt}
              closeAt={data.shop.closeAt}
              lang={L}
            />
            <Insights insights={data.insights} lang={L} atStake={data.atStakeWeek} currency={data.shop.currency} />
          </div>
          <div className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:self-start">
            <Deliveries enabled={data.deliveries.enabled} today={data.deliveries.today} recent={data.deliveries.recent} scorecard={data.deliveries.scorecard} lang={L} />
            <LiveFeed feed={data.feed} lang={L} simNow={data.clock.now} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <WeekHeatmap heat={data.heatmap} openAt={data.shop.openAt} closeAt={data.shop.closeAt} todayWd={data.clock.weekday} lang={L} />
          </div>
          <StaffingPlan rota={data.rota} openAt={data.shop.openAt} closeAt={data.shop.closeAt} todayWd={data.clock.weekday} lang={L} />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 pt-4 text-[11px] text-muted-foreground">
          <span>
            ShopSense · Ring Partner API + Amazon Bedrock · {data.totals.events.toLocaleString()} {L === "ms" ? "peristiwa kamera" : "camera events"}
          </span>
          <span>{L === "ms" ? "Tiada wajah disimpan. Hanya kiraan." : "No faces stored. Only counts."}</span>
        </footer>
      </main>

      <SalesDialog
        open={salesOpen}
        onOpenChange={setSalesOpen}
        lang={L}
        currency={data.shop.currency}
        initial={data.today.sales}
        visitors={data.today.visitors}
        onSaved={refresh}
      />
    </div>
  );
}
