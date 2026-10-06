"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AppHeader } from "@/components/shopsense/header";
import { DemoDock } from "@/components/shopsense/demo-dock";
import { HoursChart } from "@/components/shopsense/hours-chart";
import { SalesDialog } from "@/components/shopsense/sales-dialog";
import { BusyHeadline, CameraLog, DetailsTabs, EarnPanel, SuppliersPanel, WeekList, type DetailsTab } from "@/components/shopsense/details";
import { useDashboard } from "@/components/shopsense/use-dashboard";
import { LoadingScreen, useSavedLang } from "@/components/shopsense/shell";
import { tr } from "@/lib/domain/lang";

const TABS: DetailsTab[] = ["busy", "suppliers", "earn", "log"];

/**
 * Details: the numbers behind Today, split into four questions an owner asks.
 * One tab at a time, so the page never shows everything at once.
 */
export default function DetailsPage() {
  const [lang, setLang] = useSavedLang();
  const { data, error, refresh } = useDashboard(lang);
  const [salesOpen, setSalesOpen] = useState(false);
  const [tab, setTabState] = useState<DetailsTab>("busy");

  // Remember the tab in the address (#suppliers), so a link or refresh keeps it.
  useEffect(() => {
    const h = window.location.hash.slice(1) as DetailsTab;
    if (TABS.includes(h)) setTabState(h);
  }, []);
  const setTab = (t: DetailsTab) => {
    setTabState(t);
    history.replaceState(null, "", `#${t}`);
  };

  if (!data) return <LoadingScreen lang={lang} error={error} />;
  const L = lang ?? data.lang;
  const v = data.details;
  const problems = v.suppliers.today.filter((r) => r.tone === "bad" || r.tone === "warn").length;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <AppHeader shopName={data.shop.name} lang={L} setLang={setLang} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:py-10">
        {error && <p className="rounded-lg border border-[var(--red-6)] bg-[var(--red-3)] px-3 py-2 text-sm text-[var(--red-11)]">{error}</p>}

        <DetailsTabs tab={tab} setTab={setTab} lang={L} problems={problems} />

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="space-y-6">
            {tab === "busy" && (
              <>
                <BusyHeadline busy={v.busy} />
                <HoursChart
                  today={data.today.byHour}
                  typical={data.today.typicalByHour}
                  busy={data.today.busyHours}
                  nowHour={Math.floor(data.clock.minuteOfDay / 60)}
                  openAt={data.shop.openAt}
                  closeAt={data.shop.closeAt}
                  lang={L}
                />
                <WeekList week={v.week} lang={L} />
              </>
            )}
            {tab === "suppliers" && <SuppliersPanel s={v.suppliers} lang={L} />}
            {tab === "earn" && <EarnPanel compare={v.compare} earn={v.earn} lang={L} currency={data.shop.currency} onSales={() => setSalesOpen(true)} />}
            {tab === "log" && <CameraLog log={v.log} lang={L} simNow={data.clock.now} />}
          </motion.div>
        </AnimatePresence>

        <p className="pt-2 text-center text-xs text-muted-foreground">{tr(L, "No faces stored. Only counts.", "Tiada wajah disimpan. Hanya kiraan.", "不储存人脸，只记录人数。")}</p>
      </main>

      <SalesDialog open={salesOpen} onOpenChange={setSalesOpen} lang={L} currency={data.shop.currency} initial={data.today.sales} visitors={data.today.visitors} onSaved={refresh} />
      <DemoDock d={data} lang={L} refresh={refresh} />
    </div>
  );
}
