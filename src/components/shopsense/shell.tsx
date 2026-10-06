"use client";

import { useEffect, useState } from "react";
import { MathCurveLoader } from "@/components/ui/math-curve-loader";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import type { Lang } from "@/lib/domain/types";
import { isLang } from "@/lib/domain/lang";
import { t } from "./i18n";

/** The owner's language, remembered on this device. */
export function useSavedLang() {
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("shopsense:lang");
      if (isLang(saved)) setLang(saved);
    } catch {}
  }, []);
  const choose = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("shopsense:lang", l);
    } catch {}
  };
  return [lang, choose] as const;
}

export function LoadingScreen({ lang, error }: { lang: Lang | null; error: string | null }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <MathCurveLoader curve="rose" size={64} className="text-[var(--indigo-11)]" label="Loading ShopSense" />
        <FlipFadeText
          words={t(lang ?? "en").loading}
          className="min-h-0 py-2"
          textClassName="text-sm md:text-sm normal-case font-medium tracking-wide whitespace-pre text-muted-foreground dark:text-muted-foreground"
          interval={1800}
        />
        {error && <p className="max-w-sm text-sm text-[var(--red-11)]">{error}</p>}
      </div>
    </main>
  );
}
