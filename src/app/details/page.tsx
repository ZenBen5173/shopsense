"use client";

import { useState } from "react";
import { AppHeader } from "@/components/shopsense/header";
import { DemoDock } from "@/components/shopsense/demo-dock";
import { StatTiles } from "@/components/shopsense/stat-tiles";
import { HoursChart } from "@/components/shopsense/hours-chart";
import { WeekHeatmap } from "@/components/shopsense/week-heatmap";
import { StaffingPlan } from "@/components/shopsense/staffing-plan";
import { Insights } from "@/components/shopsense/insights";
import { Deliveries } from "@/components/shopsense/deliveries";
import { LiveFeed } from "@/components/shopsense/live-feed";
import { SalesDialog } from "@/components/shopsense/sales-dialog";
import { useDashboard } from "@/components/shopsense/use-dashboard";
import { LoadingScreen, useSavedLang } from "@/components/shopsense/shell";
import { tr } from "@/lib/domain/lang";

/** Everything behind the Today screen, for the owner who wants the numbers. */
export default function DetailsPage() {
  const [lang, setLang] = useSavedLang();
  const { data, error, refresh } = useDashboard(lang);
  const [salesOpen, setSalesOpen] = useState(false);

  if (!data) return <LoadingScreen lang={lang} error={error} />;
  const L = lang ?? data.lang;

  return (
    <div className="min-h-dvh bg-background pb-20">
      <AppHeader shopName={data.shop.name} lang={L} setLang={setLang} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {error && <p className="rounded-lg border border-[var(--red-6)] bg-[var(--red-3)] px-3 py-2 text-sm text-[var(--red-11)]">{error}</p>}

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-5">
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
            ShopSense · Ring Partner API + Amazon Bedrock · {data.totals.events.toLocaleString()} {tr(L, "camera events", "peristiwa kamera", "个镜头事件")}
          </span>
          <span>{tr(L, "No faces stored. Only counts.", "Tiada wajah disimpan. Hanya kiraan.", "不储存人脸，只记录人数。")}</span>
        </footer>
      </main>

      <SalesDialog open={salesOpen} onOpenChange={setSalesOpen} lang={L} currency={data.shop.currency} initial={data.today.sales} visitors={data.today.visitors} onSaved={refresh} />
      <DemoDock d={data} lang={L} refresh={refresh} />
    </div>
  );
}
