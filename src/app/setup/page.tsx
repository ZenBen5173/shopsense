"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Camera, Check, KeyRound, Link2, Plus, Store, Trash2, Truck, Sparkles, MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { Stepper } from "@/components/ui/stepper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spotlight, PanelTitle } from "@/components/shopsense/spotlight";
import { MagneticSave } from "@/components/shopsense/magnetic";
import { Logo } from "@/components/shopsense/header";
import { post } from "@/components/shopsense/use-dashboard";
import { hhmm, WEEKDAY_NAMES } from "@/lib/domain/time";
import type { CameraRole, ExpectedDelivery, ShopProfile } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface ShopState {
  shop: ShopProfile;
  source: "sim" | "ring";
  ring: { mode: "playground" | "oauth"; expiresAt: number | null } | null;
  oauthConfigured: boolean;
  bedrock: { configured: boolean; visionModel: string; textModel: string };
}
interface Cam {
  id: string;
  name: string;
  role: CameraRole;
  source: string;
}

const toMin = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
};

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `HTTP ${res.status}`);
  return out as T;
}

function RoleToggle({ id, value, onChange }: { id: string; value: CameraRole; onChange: (r: CameraRole) => void }) {
  const opts: { v: CameraRole; label: string }[] = [
    { v: "front", label: "Front door" },
    { v: "back", label: "Back door" },
    { v: "ignore", label: "Not used" },
  ];
  return (
    <div className="flex rounded-full border border-border bg-muted/50 p-0.5">
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={cn("relative z-10 rounded-full px-3 py-1 text-xs font-medium transition-colors", value === o.v ? "text-background" : "text-muted-foreground hover:text-foreground")}>
          {value === o.v && <motion.span layoutId={`role-${id}`} className="absolute inset-0 -z-10 rounded-full bg-foreground" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SetupPage() {
  const [state, setState] = useState<ShopState | null>(null);
  const [cams, setCams] = useState<Cam[]>([]);
  const [expected, setExpected] = useState<ExpectedDelivery[]>([]);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [supplier, setSupplier] = useState({ name: "", days: [] as number[], start: "10:00", end: "11:00" });
  const [shopForm, setShopForm] = useState<Partial<ShopProfile>>({});

  const load = useCallback(async () => {
    const [s, c, e] = await Promise.all([send<ShopState>("/api/shop", "GET"), send<Cam[]>("/api/cameras", "GET"), send<ExpectedDelivery[]>("/api/deliveries/expected", "GET")]);
    setState(s);
    setCams(c);
    setExpected(e);
    setShopForm(s.shop);
  }, []);

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
    const p = new URLSearchParams(window.location.search).get("ring");
    if (p === "linked") toast.success("Ring account linked. Now tag your cameras.");
    else if (p) toast.error(`Ring link: ${p}`);
  }, [load]);

  const tagged = cams.filter((c) => c.role !== "ignore").length;
  const current = !state ? 0 : state.source === "ring" && !state.ring ? 0 : tagged === 0 ? 1 : expected.length === 0 ? 2 : 3;

  async function connect(mode: "playground" | "sim") {
    setConnecting(true);
    try {
      await post("/api/ring/connect", mode === "sim" ? { mode } : { mode, token });
      toast.success(mode === "sim" ? "Back on the demo shop." : "Connected to Ring. Tag each camera below.");
      setToken("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function setRole(id: string, role: CameraRole) {
    setCams((cs) => cs.map((c) => (c.id === id ? { ...c, role } : c)));
    try {
      setCams(await send<Cam[]>("/api/cameras", "PATCH", { id, role }));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    try {
      setExpected(await send<ExpectedDelivery[]>("/api/deliveries/expected", "POST", { supplierName: supplier.name, weekdays: supplier.days, windowStart: toMin(supplier.start), windowEnd: toMin(supplier.end) }));
      setSupplier({ name: "", days: [], start: supplier.start, end: supplier.end });
      toast.success("Supplier added");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function saveShop(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("/api/shop", "PATCH", shopForm);
      toast.success("Shop details saved");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // Group expected deliveries by supplier + window for a compact list.
  const groups = Object.values(
    expected.reduce<Record<string, { key: string; name: string; window: string; items: ExpectedDelivery[] }>>((acc, x) => {
      const key = `${x.supplierName}|${x.windowStart}|${x.windowEnd}`;
      (acc[key] ??= { key, name: x.supplierName, window: `${hhmm(x.windowStart)}–${hhmm(x.windowEnd)}`, items: [] }).items.push(x);
      return acc;
    }, {}),
  );

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" /> Dashboard
          </Link>
          <span className="ml-auto flex items-center gap-2">
            <Logo className="size-7" />
            <span className="font-display font-semibold">Setup</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
        <Stepper
          current={current}
          steps={[
            { label: "Connect Ring", description: "Demo, Playground or account" },
            { label: "Tag cameras", description: "Front or back door" },
            { label: "Suppliers", description: "Who delivers when" },
            { label: "Shop", description: "Hours and staff uniform" },
          ]}
        />

        {/* 1. Source */}
        <Spotlight className="p-5">
          <PanelTitle title="1 · Connect your cameras" sub="ShopSense reads motion events and snapshots from the Ring Partner API. Read-only: it can never arm, unlock or talk." />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button
              onClick={() => connect("sim")}
              disabled={connecting}
              className={cn("group rounded-xl border p-4 text-left transition hover:-translate-y-0.5", state?.source === "sim" ? "border-[var(--indigo-8)] bg-[var(--indigo-3)]" : "border-border hover:border-foreground/20")}
            >
              <MonitorPlay className="size-5 text-[var(--indigo-11)] transition-transform group-hover:scale-110" />
              <p className="mt-2 text-sm font-semibold">Demo shop</p>
              <p className="mt-1 text-xs text-muted-foreground">A simulated Ring account: two cameras, a month of history, a day replaying live.</p>
              {state?.source === "sim" && <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--indigo-11)]"><Check className="size-3" /> In use</p>}
            </button>

            <div className={cn("rounded-xl border p-4", state?.source === "ring" && state.ring?.mode === "playground" ? "border-[var(--grass-8)] bg-[var(--grass-2)]" : "border-border")}>
              <KeyRound className="size-5 text-[var(--grass-11)]" />
              <p className="mt-2 text-sm font-semibold">Ring Playground token</p>
              <p className="mt-1 text-xs text-muted-foreground">
                From the <a className="underline hover:text-foreground" href="https://developer.amazon.com/ring/console/playground" target="_blank" rel="noreferrer">Ring developer console</a>. Lasts about 30 minutes.
              </p>
              <div className="mt-2 flex gap-2">
                <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste token" type="password" className="h-8 text-xs" />
                <button onClick={() => connect("playground")} disabled={connecting || token.length < 20} className="shrink-0 rounded-md bg-foreground px-3 text-xs font-medium text-background disabled:opacity-40">
                  Use
                </button>
              </div>
              {state?.ring?.mode === "playground" && state.ring.expiresAt && (
                <p className="mt-2 text-[11px] text-muted-foreground">Expires {new Date(state.ring.expiresAt).toLocaleTimeString()}</p>
              )}
            </div>

            <div className={cn("rounded-xl border p-4", state?.ring?.mode === "oauth" ? "border-[var(--grass-8)] bg-[var(--grass-2)]" : "border-border")}>
              <Link2 className="size-5 text-[var(--amber-11)]" />
              <p className="mt-2 text-sm font-semibold">Link a Ring account</p>
              <p className="mt-1 text-xs text-muted-foreground">OAuth with PKCE, as a Ring Appstore app. Tokens refresh on their own.</p>
              {state?.oauthConfigured ? (
                <a href="/api/ring/oauth/start" className="mt-2 inline-flex rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background">Link account</a>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">Needs RING_CLIENT_ID and RING_CLIENT_SECRET on the server.</p>
              )}
            </div>
          </div>
        </Spotlight>

        {/* 2. Cameras */}
        <Spotlight className="p-5">
          <PanelTitle title="2 · Tag each camera" sub="The tag decides which brain reads it: front door counts customers, back door logs deliveries." />
          <ul className="mt-4 divide-y divide-border">
            {cams.length === 0 && <li className="py-3 text-sm text-muted-foreground">No cameras yet. Connect Ring above.</li>}
            {cams.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid size-9 place-items-center rounded-xl border border-border bg-muted"><Camera className="size-4 text-muted-foreground" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{c.id}</p>
                </div>
                <RoleToggle id={c.id} value={c.role} onChange={(r) => setRole(c.id, r)} />
              </li>
            ))}
          </ul>
        </Spotlight>

        {/* 3. Suppliers */}
        <Spotlight className="p-5">
          <PanelTitle title="3 · Who delivers, and when" sub="ShopSense flags a delivery as late when it arrives more than 30 minutes after its window, and missing when the window passes with no van." />
          <ul className="mt-4 space-y-1.5">
            {groups.map((g) => (
              <li key={g.key} className="group flex flex-wrap items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60">
                <Truck className="size-4 text-muted-foreground" />
                <p className="min-w-40 flex-1 text-sm font-medium">{g.name}</p>
                <div className="flex flex-wrap gap-1">
                  {g.items.map((x) => (
                    <button
                      key={x.id}
                      title="Remove this day"
                      onClick={async () => setExpected(await send<ExpectedDelivery[]>(`/api/deliveries/expected?id=${x.id}`, "DELETE"))}
                      className="group/day inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-[var(--red-7)] hover:text-[var(--red-11)]"
                    >
                      {WEEKDAY_NAMES.en[x.weekday].slice(0, 3)}
                      <Trash2 className="hidden size-3 group-hover/day:inline" />
                    </button>
                  ))}
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{g.window}</span>
              </li>
            ))}
          </ul>
          <form onSubmit={addSupplier} className="mt-4 grid gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="sup">Supplier</Label>
              <Input id="sup" value={supplier.name} onChange={(e) => setSupplier({ ...supplier, name: e.target.value })} placeholder="e.g. Segar Fresh Produce" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="time" value={supplier.start} onChange={(e) => setSupplier({ ...supplier, start: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="time" value={supplier.end} onChange={(e) => setSupplier({ ...supplier, end: e.target.value })} />
            </div>
            <MagneticSave disabled={!supplier.name || supplier.days.length === 0} className="h-9 py-0">
              <span className="inline-flex items-center gap-1"><Plus className="size-4" /> Add</span>
            </MagneticSave>
            <div className="flex flex-wrap gap-1.5 sm:col-span-4">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const on = supplier.days.includes(wd);
                return (
                  <button
                    type="button"
                    key={wd}
                    onClick={() => setSupplier({ ...supplier, days: on ? supplier.days.filter((d) => d !== wd) : [...supplier.days, wd] })}
                    className={cn("rounded-full border px-3 py-1 text-xs transition", on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}
                  >
                    {WEEKDAY_NAMES.en[wd].slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </form>
        </Spotlight>

        {/* 4. Shop */}
        <Spotlight className="p-5">
          <PanelTitle title="4 · Your shop" sub="Opening hours separate staff opening up from customers. The uniform hint lets the AI tell staff apart without ever recognising faces." />
          <form onSubmit={saveShop} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name"><Store className="mr-1 inline size-3.5" />Shop name</Label>
              <Input id="name" value={shopForm.name ?? ""} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hint">What staff wear</Label>
              <Input id="hint" value={shopForm.staffHint ?? ""} onChange={(e) => setShopForm({ ...shopForm, staffHint: e.target.value })} placeholder="e.g. red apron" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="open">Opens</Label>
                <Input id="open" type="time" value={shopForm.openAt !== undefined ? hhmm(shopForm.openAt) : ""} onChange={(e) => setShopForm({ ...shopForm, openAt: toMin(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="close">Closes</Label>
                <Input id="close" type="time" value={shopForm.closeAt !== undefined ? hhmm(shopForm.closeAt) : ""} onChange={(e) => setShopForm({ ...shopForm, closeAt: toMin(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tz">Timezone</Label>
                <Input id="tz" value={shopForm.timezone ?? ""} onChange={(e) => setShopForm({ ...shopForm, timezone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cur">Currency</Label>
                <Input id="cur" value={shopForm.currency ?? ""} onChange={(e) => setShopForm({ ...shopForm, currency: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <div className="flex rounded-full border border-border bg-muted/50 p-0.5 text-xs">
                {(["en", "ms"] as const).map((l) => (
                  <button type="button" key={l} onClick={() => setShopForm({ ...shopForm, lang: l })} className={cn("rounded-full px-3 py-1 transition", shopForm.lang === l ? "bg-foreground text-background" : "text-muted-foreground")}>
                    {l === "en" ? "English" : "Bahasa Melayu"}
                  </button>
                ))}
              </div>
              <MagneticSave>Save</MagneticSave>
            </div>
          </form>
        </Spotlight>

        {/* AI status */}
        <Spotlight className="p-5" glow="rgba(99,102,241,0.18)">
          <PanelTitle title="AI on Amazon Bedrock" sub="Vision reads each snapshot; a text model writes the advice. Numbers always come from ShopSense, never from the model." />
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", state?.bedrock.configured ? "border-[var(--grass-7)] text-[var(--grass-11)]" : "border-border text-muted-foreground")}>
              <Sparkles className="size-3.5" /> {state?.bedrock.configured ? "Connected" : "Not configured: using offline perception and template advice"}
            </span>
            {state && (
              <span className="font-mono text-[11px] text-muted-foreground">
                vision {state.bedrock.visionModel} · text {state.bedrock.textModel}
              </span>
            )}
          </div>
        </Spotlight>
      </main>
    </div>
  );
}
