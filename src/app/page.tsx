"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AppHeader } from "@/components/shopsense/header";
import { DemoDock } from "@/components/shopsense/demo-dock";
import { SalesDialog } from "@/components/shopsense/sales-dialog";
import { AdvisorNote, FocusCard, Lights, TodayActions, TodoList } from "@/components/shopsense/today";
import { useDashboard } from "@/components/shopsense/use-dashboard";
import { LoadingScreen, useSavedLang } from "@/components/shopsense/shell";
import { WEEKDAY_NAMES } from "@/lib/domain/time";

/**
 * Today: the owner's whole day on one calm screen. One thing to do now, three
 * traffic lights, a short to-do list. The numbers live on the Details page.
 */
export default function TodayPage() {
  const [lang, setLang] = useSavedLang();
  const { data, error, refresh, setData } = useDashboard(lang);
  const [salesOpen, setSalesOpen] = useState(false);

  if (!data) return <LoadingScreen lang={lang} error={error} />;
  const L = lang ?? data.lang;
  const v = data.owner;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <AppHeader shopName={data.shop.name} lang={L} setLang={setLang} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:py-10">
        {error && <p className="rounded-lg border border-[var(--red-6)] bg-[var(--red-3)] px-3 py-2 text-sm text-[var(--red-11)]">{error}</p>}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <p className="text-sm text-muted-foreground">
            {WEEKDAY_NAMES[L][data.clock.weekday]} · <span className="tabular-nums">{data.clock.local}</span>
          </p>
          <p className="mt-0.5 font-display text-3xl font-semibold tracking-tight">{v.greeting}</p>
        </motion.div>

        <FocusCard focus={v.focus} lang={L} />
        <Lights view={v} lang={L} onSales={() => setSalesOpen(true)} />
        <TodoList todo={v.todo} date={data.clock.date} lang={L} />
        <AdvisorNote advice={data.advice} lang={L} onAdvice={(advice) => setData({ ...data, advice })} />
        <TodayActions view={v} shopName={data.shop.name} lang={L} />
      </main>

      <SalesDialog open={salesOpen} onOpenChange={setSalesOpen} lang={L} currency={data.shop.currency} initial={data.today.sales} visitors={data.today.visitors} onSaved={refresh} />
      <DemoDock d={data} lang={L} refresh={refresh} />
    </div>
  );
}
