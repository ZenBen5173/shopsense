"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Clock3, MessageCircle, Phone, RefreshCw, Sun, Truck, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { OwnerView, Tone } from "@/lib/owner";
import type { Advice } from "@/lib/advice";
import type { Lang } from "@/lib/domain/types";
import { tr } from "@/lib/domain/lang";
import { Spotlight } from "./spotlight";
import { post } from "./use-dashboard";
import { cn } from "@/lib/utils";

const TONE: Record<Tone, { card: string; ink: string; dot: string; glow: string }> = {
  bad: { card: "border-[var(--red-7)] bg-[var(--red-2)]", ink: "text-[var(--red-11)]", dot: "bg-[var(--red-9)]", glow: "rgba(229,72,77,0.18)" },
  warn: { card: "border-[var(--amber-7)] bg-[var(--amber-2)]", ink: "text-[var(--amber-11)]", dot: "bg-[var(--amber-9)]", glow: "rgba(255,197,61,0.16)" },
  good: { card: "border-[var(--grass-7)] bg-[var(--grass-2)]", ink: "text-[var(--grass-11)]", dot: "bg-[var(--grass-9)]", glow: "rgba(70,167,88,0.16)" },
  calm: { card: "border-[var(--indigo-6)] bg-[var(--indigo-2)]", ink: "text-[var(--indigo-11)]", dot: "bg-[var(--indigo-9)]", glow: "rgba(99,102,241,0.16)" },
};
const FOCUS_ICON = { phone: Phone, truck: Truck, users: Users, clock: Clock3, sun: Sun };

const rise = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.06 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
});

/** "Do this now": the one thing that matters most at this moment. */
export function FocusCard({ focus, lang }: { focus: OwnerView["focus"]; lang: Lang }) {
  const Icon = FOCUS_ICON[focus.icon];
  const tone = TONE[focus.tone];
  return (
    <motion.div {...rise(1)}>
      <Spotlight glow={tone.glow} size={480} className={cn("p-6 sm:p-7", tone.card)}>
        <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", tone.ink)}>{tr(lang, "Do this now", "Buat sekarang", "现在要做")}</p>
        <div className="mt-3 flex items-start gap-4">
          <motion.span
            key={focus.title}
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className={cn("grid size-12 shrink-0 place-items-center rounded-2xl border bg-background/40 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105", tone.card, tone.ink)}
          >
            <Icon className="size-6" />
          </motion.span>
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.h1
                key={focus.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]"
              >
                {focus.title}
              </motion.h1>
            </AnimatePresence>
            <p className="mt-1.5 text-base text-foreground/75">{focus.detail}</p>
          </div>
        </div>
      </Spotlight>
    </motion.div>
  );
}

function Light({ icon: Icon, label, tone, children, onClick, i }: { icon: typeof Users; label: string; tone: Tone; children: React.ReactNode; onClick?: () => void; i: number }) {
  const body = (
    <Spotlight glow={TONE[tone].glow} className="h-full p-3 text-left sm:p-4">
      <p className="flex items-center gap-1.5 truncate text-xs font-medium text-muted-foreground">
        <Icon className="size-4 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </Spotlight>
  );
  return (
    <motion.div {...rise(2 + i)} className="min-w-0">
      {onClick ? (
        <button onClick={onClick} className="block h-full w-full rounded-2xl transition-transform hover:-translate-y-0.5 active:scale-[0.98]">
          {body}
        </button>
      ) : (
        body
      )}
    </motion.div>
  );
}

function Word({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <p className={cn("mt-1 flex items-start gap-1.5 text-xs leading-snug sm:text-sm", TONE[tone].ink)}>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE[tone].dot)} />
      <span>{children}</span>
    </p>
  );
}

/** Three traffic lights: customers, deliveries, money. */
export function Lights({ view, lang, onSales }: { view: OwnerView; lang: Lang; onSales: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <Light i={0} icon={Users} label={tr(lang, "Customers", "Pelanggan", "顾客")} tone={view.customers.tone}>
        <AnimatedNumber value={view.customers.value} className="font-display text-3xl font-semibold tabular-nums sm:text-4xl" />
        <Word tone={view.customers.tone}>{view.customers.word}</Word>
      </Light>
      <Light i={1} icon={Truck} label={tr(lang, "Deliveries", "Penghantaran", "送货")} tone={view.deliveries.tone}>
        <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{view.deliveries.value}</p>
        <Word tone={view.deliveries.tone}>{view.deliveries.word}</Word>
      </Light>
      <Light i={2} icon={Wallet} label={tr(lang, "Sales", "Jualan", "营业额")} tone={view.sales.tone} onClick={onSales}>
        <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{view.sales.value ?? "—"}</p>
        <Word tone={view.sales.tone}>
          {view.sales.word}
          {!view.sales.done && <ArrowRight className="ml-1 inline size-3.5 transition-transform group-hover:translate-x-0.5" />}
        </Word>
      </Light>
    </div>
  );
}

/** At most three to-dos, ticked off with a satisfying check. Ticks are remembered for the day. */
export function TodoList({ todo, date, lang }: { todo: OwnerView["todo"]; date: string; lang: Lang }) {
  const key = `shopsense:done:${date}`;
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      setDone([]);
    }
  }, [key]);
  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  if (!todo.length) return null;

  return (
    <motion.section {...rise(5)}>
      <h2 className="text-sm font-semibold text-muted-foreground">{tr(lang, "Today's to-do", "Senarai hari ini", "今日待办")}</h2>
      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {todo.map((item) => {
          const on = done.includes(item.id);
          return (
            <li key={item.id}>
              <button onClick={() => toggle(item.id)} className="group flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-muted/50">
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border-2 transition-all duration-300", on ? "border-[var(--grass-9)] bg-[var(--grass-9)]" : "border-border group-hover:border-foreground/40")}>
                  <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.28, ease: "easeOut" }} />
                  </svg>
                </span>
                <span className={cn("text-base transition-colors", on && "text-muted-foreground line-through decoration-[var(--grass-9)] decoration-2")}>{item.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}

/** One line from the advisor (Claude on Bedrock when connected), with a way to ask again. */
export function AdvisorNote({ advice, lang, onAdvice }: { advice: Advice; lang: Lang; onAdvice: (a: Advice) => void }) {
  const [busy, setBusy] = useState(false);
  const line = advice.sentences[advice.sentences.length - 1];
  // The offline writer only rephrases what the to-do already says; show a tip
  // only when the AI advisor has written one.
  if (!line || !advice.provider.startsWith("bedrock:")) return null;
  const by = advice.provider.startsWith("bedrock:") ? "Claude · Amazon Bedrock" : tr(lang, "ShopSense (offline)", "ShopSense (luar talian)", "ShopSense（离线）");
  async function ask() {
    setBusy(true);
    try {
      const next = await post<Advice>("/api/advice", { lang });
      onAdvice(next);
      if (next.provider === "template") toast.info(tr(lang, "AI isn't connected yet, so this is the offline advice.", "AI belum disambung. Ini nasihat luar talian.", "AI 还没连接，这是离线建议。"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <motion.section {...rise(6)} className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-[15px] leading-relaxed text-foreground/85">“{line}”</p>
        <button onClick={ask} disabled={busy} aria-label={tr(lang, "Ask again", "Tanya lagi", "再问一次")} className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-foreground disabled:opacity-50">
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {tr(lang, "Tip from your advisor", "Tip daripada penasihat", "顾问小建议")} · {by}
      </p>
    </motion.section>
  );
}

export function TodayActions({ view, shopName, lang }: { view: OwnerView; shopName: string; lang: Lang }) {
  const text = [
    `ShopSense · ${shopName}`,
    `${tr(lang, "Now", "Sekarang", "现在")}: ${view.focus.title}`,
    ...view.todo.map((x) => `☐ ${x.text}`),
  ].join("\n");
  return (
    <motion.div {...rise(7)} className="flex flex-col gap-2 sm:flex-row">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        className="group flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--grass-7)] bg-[var(--grass-3)] px-4 py-3.5 text-base font-medium text-[var(--grass-11)] transition hover:-translate-y-0.5 hover:bg-[var(--grass-4)]"
      >
        <MessageCircle className="size-5 transition-transform duration-300 group-hover:-rotate-12" />
        {tr(lang, "Send to my WhatsApp", "Hantar ke WhatsApp saya", "发到我的 WhatsApp")}
      </a>
      <Link
        href="/details"
        className="group flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-base font-medium transition hover:-translate-y-0.5 hover:border-foreground/30"
      >
        {tr(lang, "See the details", "Lihat butiran", "查看详情")}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </motion.div>
  );
}
