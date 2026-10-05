"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import TextAnimation from "@/components/ui/staggerText";
import { GenerateButton } from "@/components/ui/generate-button";
import type { Advice } from "@/lib/advice";
import type { Lang } from "@/lib/domain/types";
import type { Alert } from "@/lib/dashboard";
import { Spotlight } from "./spotlight";
import { t } from "./i18n";
import { post } from "./use-dashboard";
import { cn } from "@/lib/utils";

function providerLabel(p: string, lang: Lang) {
  if (p.startsWith("bedrock:")) {
    const model = p.slice(8);
    const pretty = model.includes("claude") ? `Claude (${model.split("anthropic.")[1] ?? model})` : model.includes("nova") ? "Amazon Nova" : model;
    return `${pretty} on Amazon Bedrock`;
  }
  return t(lang).offlineAdvisor;
}

const TONE: Record<Alert["tone"], string> = {
  bad: "bg-[var(--red-3)] text-[var(--red-11)] border-[var(--red-6)]",
  warn: "bg-[var(--amber-3)] text-[var(--amber-11)] border-[var(--amber-6)]",
  good: "bg-[var(--grass-3)] text-[var(--grass-11)] border-[var(--grass-6)]",
  info: "bg-[var(--indigo-3)] text-[var(--indigo-11)] border-[var(--indigo-6)]",
};

/** The day's advice as a short message an owner can forward to staff or keep in a chat. */
export function briefText(o: { shop: string; dateLabel: string; sentences: string[]; visitors: number; lang: Lang }) {
  const head = `ShopSense · ${o.shop} · ${o.dateLabel}`;
  const tail = o.lang === "ms" ? `Pengunjung setakat ini: ${o.visitors}` : `Visitors so far: ${o.visitors}`;
  return [head, ...o.sentences.map((s) => `• ${s}`), tail].join("\n");
}

export function AdviceCard({
  advice,
  alerts,
  lang,
  onAdvice,
  shopName,
  dateLabel,
  visitors,
}: {
  advice: Advice;
  alerts: Alert[];
  lang: Lang;
  onAdvice: (a: Advice) => void;
  shopName: string;
  dateLabel: string;
  visitors: number;
}) {
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = briefText({ shop: shopName, dateLabel, sentences: advice.sentences, visitors, lang });

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(lang === "ms" ? "Tidak dapat menyalin" : "Couldn't copy");
    }
  }
  const c = t(lang);

  async function ask() {
    setWorking(true);
    try {
      const next = await post<Advice>("/api/advice", { lang });
      onAdvice(next);
      if (next.provider === "template")
        toast.info(lang === "ms" ? "AI belum disambung. Ini nasihat luar talian." : "AI isn't connected yet, so this is the offline advice. Add AWS keys to use Bedrock.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Spotlight as="section" glow="rgba(99,102,241,0.22)" size={520} className="p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[var(--indigo-9)] opacity-[0.07] blur-3xl" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="size-3.5 text-[var(--indigo-11)]" />
          {c.advice}
        </p>
        <GenerateButton
          hue={235}
          label={c.refresh}
          activeLabel={c.thinking}
          isGenerating={working}
          onClick={ask}
          disabled={working}
        />
      </div>

      <div className="mt-5 space-y-3">
        <AnimatePresence mode="popLayout">
          {advice.sentences.map((s, i) => (
            <motion.p
              key={`${s}-${i}`}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className={cn(
                "font-display text-balance leading-snug tracking-tight",
                i === 0 ? "text-2xl sm:text-[28px] text-foreground" : "text-lg sm:text-xl text-foreground/80",
              )}
            >
              <TextAnimation delay={i * 0.25}>{s}</TextAnimation>
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {alerts.filter((a) => !advice.sentences.includes(a.text)).slice(0, 3).map((a, i) => (
          <motion.span
            key={a.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.08 }}
            className={cn("rounded-full border px-3 py-1 text-xs", TONE[a.tone])}
          >
            {a.text}
          </motion.span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {c.writtenBy} {providerLabel(advice.provider, lang)}
        </p>
        <div className="flex items-center gap-1.5">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
            className="group/wa inline-flex items-center gap-1.5 rounded-full border border-[var(--grass-7)] bg-[var(--grass-3)] px-3 py-1.5 text-xs font-medium text-[var(--grass-11)] transition hover:-translate-y-0.5 hover:bg-[var(--grass-4)]"
          >
            <MessageCircle className="size-3.5 transition-transform duration-300 group-hover/wa:-rotate-12 group-hover/wa:scale-110" />
            {lang === "ms" ? "Hantar ke WhatsApp" : "Send to WhatsApp"}
          </a>
          <button
            onClick={copy}
            aria-label={lang === "ms" ? "Salin nasihat" : "Copy advice"}
            className="relative grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition hover:-translate-y-0.5 hover:text-foreground"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={copied ? "ok" : "copy"} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                {copied ? <Check className="size-3.5 text-[var(--grass-11)]" /> : <Copy className="size-3.5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </Spotlight>
  );
}
