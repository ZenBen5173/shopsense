import type { Lang } from "./types";

/** Pick the string for `lang`. Keeps the three languages side by side at every call site. */
export function tr(lang: Lang, en: string, ms: string, zh: string): string {
  return lang === "ms" ? ms : lang === "zh" ? zh : en;
}

export const LANGS: Lang[] = ["en", "ms", "zh"];
export const LANG_LABEL: Record<Lang, string> = { en: "EN", ms: "BM", zh: "中文" };
export const isLang = (v: unknown): v is Lang => v === "en" || v === "ms" || v === "zh";
