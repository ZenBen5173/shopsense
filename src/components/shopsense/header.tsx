"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Settings2 } from "lucide-react";
import type { Lang } from "@/lib/domain/types";
import { LANG_LABEL, LANGS, tr } from "@/lib/domain/lang";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("relative grid size-8 place-items-center rounded-xl bg-[var(--indigo-9)] text-white shadow-[0_0_24px_-4px_var(--indigo-9)]", className)}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 10l9-6 9 6v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
        <circle cx="12" cy="10.5" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  render,
  id,
  size = "sm",
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  render: (v: T) => React.ReactNode;
  id: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="relative flex rounded-full border border-border bg-muted/50 p-0.5">
      {options.map((o) => (
        <button
          key={String(o)}
          onClick={() => onChange(o)}
          className={cn(
            "relative z-10 rounded-full font-medium transition-colors",
            size === "md" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-[11px]",
            value === o ? "text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {value === o && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 -z-10 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
          {render(o)}
        </button>
      ))}
    </div>
  );
}

/** The one header every owner page shares: who you are, where you are, your language. */
export function AppHeader({ shopName, lang, setLang }: { shopName: string; lang: Lang; setLang: (l: Lang) => void }) {
  const path = usePathname();
  const tabs = [
    { href: "/", label: tr(lang, "Today", "Hari ini", "今天") },
    { href: "/details", label: tr(lang, "Details", "Butiran", "详情") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <Logo className="shrink-0 transition-transform duration-300 group-hover:rotate-[-8deg]" />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[15px] font-semibold tracking-tight">ShopSense</p>
            <p className="truncate text-[11px] text-muted-foreground">{shopName}</p>
          </div>
        </Link>

        <nav className="ml-2 hidden rounded-full border border-border bg-muted/40 p-0.5 sm:flex">
          {tabs.map((t) => {
            const active = path === t.href;
            return (
              <Link key={t.href} href={t.href} className={cn("relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", active ? "text-background" : "text-muted-foreground hover:text-foreground")}>
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                <span className="relative">{t.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Segmented id="lang" value={lang} options={LANGS} onChange={setLang} render={(v) => LANG_LABEL[v]} />
          <Link href="/setup" className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:rotate-45 hover:bg-muted hover:text-foreground" aria-label={tr(lang, "Settings", "Tetapan", "设置")}>
            <Settings2 className="size-[18px]" />
          </Link>
        </div>
      </div>

      {/* Phones: the two tabs sit under the header, full width, thumb-sized. */}
      <nav className="flex gap-1 border-t border-border/60 px-4 py-2 sm:hidden">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <Link key={t.href} href={t.href} className={cn("relative flex-1 rounded-full py-2 text-center text-sm font-medium transition-colors", active ? "text-background" : "text-muted-foreground")}>
              {active && <motion.span layoutId="nav-pill-m" className="absolute inset-0 -z-10 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
