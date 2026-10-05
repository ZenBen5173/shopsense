"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import type { Advice } from "@/lib/advice";
import type { Lang } from "@/lib/domain/types";

export type DashboardResponse = DashboardData & { advice: Advice };

/**
 * Keeps the dashboard live: every few seconds it asks the server to poll Ring
 * once (the "poller" in a serverless world), then refetches the dashboard.
 * Pauses while the tab is hidden so an idle tab doesn't burn vision calls.
 */
export function useDashboard(lang: Lang | null, intervalMs = 3000) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const langRef = useRef(lang);
  langRef.current = lang;

  const load = useCallback(async () => {
    const q = langRef.current ? `?lang=${langRef.current}` : "";
    const res = await fetch(`/api/dashboard${q}`, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    setData(body);
    setError(null);
  }, []);

  const step = useCallback(async () => {
    if (busy.current || document.hidden) return;
    busy.current = true;
    try {
      await fetch("/api/tick", { method: "POST" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      busy.current = false;
    }
  }, [load]);

  useEffect(() => {
    load().catch((err) => setError((err as Error).message)).then(step);
    const id = setInterval(step, intervalMs);
    return () => clearInterval(id);
  }, [load, step, intervalMs]);

  useEffect(() => {
    if (lang) load().catch(() => undefined);
  }, [lang, load]);

  return { data, error, refresh: load, setData };
}

export async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `HTTP ${res.status}`);
  return out as T;
}
