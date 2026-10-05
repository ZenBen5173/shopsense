"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft, Brain, Camera, Database, DoorOpen, EyeOff, Image as ImageIcon, LayoutDashboard, Link2, MessageSquareText, Radio, ShieldCheck, Truck,
} from "lucide-react";
import TextAnimation from "@/components/ui/staggerText";
import { MathCurveLoader } from "@/components/ui/math-curve-loader";
import { Spotlight, PanelTitle } from "@/components/shopsense/spotlight";
import { Logo } from "@/components/shopsense/header";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Camera, title: "Ring camera", body: "A motion event fires on the front door or back lane camera the shop already owns." },
  { icon: Radio, title: "Poller + webhook", body: "Event History is polled every few seconds (Playground has no push); signed webhooks deliver instantly in production. De-duplicated by Ring event id." },
  { icon: ImageIcon, title: "Snapshot", body: "POST /media/image/download at the moment of motion. Front-door images are analysed and dropped, never stored." },
  { icon: Brain, title: "Bedrock vision", body: "Converse API: who is walking in vs out, staff vs customer (by uniform, never by face), or which supplier's van is at the back door." },
  { icon: Database, title: "Postgres", body: "Counts and verdicts only. Supabase in production; embedded PGlite for a zero-setup demo." },
  { icon: Link2, title: "Three brains", body: "Front door: footfall, busy hours, buyers vs visitors. Back door: delivery log, late and missing. The link: the two together." },
  { icon: MessageSquareText, title: "Bedrock advice", body: "A text model turns the computed facts into two or three plain sentences, in English or Bahasa Melayu. It never invents a number." },
  { icon: LayoutDashboard, title: "One screen", body: "What to do today first. Then the numbers behind it, for when the owner wants them." },
];

interface Ev {
  id: string;
  camera: string;
  role: string;
  at: string;
  subType: string | null;
  vision: Record<string, unknown>;
  provider: string | null;
}

function VisionInspector() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/events?limit=14").then((r) => r.json()).then((e: Ev[]) => {
      setEvents(e);
      const delivery = e.find((x) => x.role === "back" && x.vision.isDelivery === true && x.vision.supplierText);
      setSel(delivery?.id ?? e.find((x) => x.role === "back")?.id ?? e[0]?.id ?? null);
    });
  }, []);
  const cur = events?.find((e) => e.id === sel);
  return (
    <Spotlight className="p-5">
      <PanelTitle title="See the vision step" sub="Real rows from this instance: the snapshot, and exactly what the vision step returned for it." />
      {!events ? (
        <div className="grid h-60 place-items-center"><MathCurveLoader curve="lissajous" size={48} className="text-[var(--indigo-11)]" /></div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
          <ul className="max-h-[420px] space-y-1 overflow-y-auto pr-1 scrollbar-thin">
            {events.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setSel(e.id)}
                  className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors", sel === e.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                >
                  {e.role === "back" ? <Truck className="size-3.5 shrink-0" /> : <DoorOpen className="size-3.5 shrink-0" />}
                  <span className="truncate">{e.camera}</span>
                  <span className="ml-auto font-mono tabular-nums opacity-70">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" })}</span>
                </button>
              </li>
            ))}
          </ul>
          {cur && (
            <motion.div key={cur.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/snapshots/${encodeURIComponent(cur.id)}`} alt={`Snapshot from ${cur.camera}`} className="w-full rounded-xl border border-border" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">vision_result</p>
                <pre className="mt-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">{JSON.stringify(cur.vision, null, 2)}</pre>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  provider: <span className="font-mono">{cur.provider}</span> · Ring sub_type: <span className="font-mono">{cur.subType ?? "—"}</span>
                </p>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </Spotlight>
  );
}

export default function HowItWorks() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" /> Dashboard
          </Link>
          <span className="ml-auto flex items-center gap-2"><Logo className="size-7" /><span className="font-display font-semibold">How ShopSense works</span></span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <section className="max-w-3xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--indigo-11)]">Ring track · business systems</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            <TextAnimation>The camera already sees your business.</TextAnimation>{" "}
            <span className="text-muted-foreground"><TextAnimation delay={0.35}>ShopSense tells you what it saw.</TextAnimation></span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Footfall analytics exists for retail chains, with new sensors and a contract. A kedai runcit, a café or a hardware shop already has a Ring camera for safety. ShopSense reuses it: no new hardware, one number typed at closing, and advice in plain words.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
              <Spotlight className="h-full p-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg border border-border bg-muted transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    <s.icon className="size-4 text-[var(--indigo-11)]" />
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
              </Spotlight>
            </motion.div>
          ))}
        </section>

        <VisionInspector />

        <section className="grid gap-3 md:grid-cols-3">
          <Spotlight className="p-5" glow="rgba(70,167,88,0.16)">
            <ShieldCheck className="size-5 text-[var(--grass-11)]" />
            <h3 className="mt-2 font-semibold">Privacy by design</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>Read-only Ring scope (<span className="font-mono text-xs">ava.v1:read</span>): no arming, unlocking or talk.</li>
              <li>No face recognition. Staff are told apart by uniform the owner describes.</li>
              <li>Front-door snapshots are analysed in memory and discarded; only counts are kept.</li>
              <li>Back-door snapshots are kept only for deliveries, as proof of arrival.</li>
            </ul>
          </Spotlight>
          <Spotlight className="p-5" glow="rgba(255,197,61,0.14)">
            <EyeOff className="size-5 text-[var(--amber-11)]" />
            <h3 className="mt-2 font-semibold">Honest numbers</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>Every count carries a ± band built from the vision step&apos;s own confidence.</li>
              <li>People walking out are counted separately, so nobody is counted twice.</li>
              <li>Buyers vs visitors only uses days where the owner entered sales.</li>
              <li>The advice model is given computed facts and told not to add any.</li>
            </ul>
          </Spotlight>
          <Spotlight className="p-5">
            <Link2 className="size-5 text-[var(--indigo-11)]" />
            <h3 className="mt-2 font-semibold">Why two doors</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The front door says when customers come. The back door says when stock comes. Only together can ShopSense notice that a produce van blocks the lane in the Saturday lunch rush, or that the days the drinks lorry runs late are the days fewer visitors buy.
            </p>
          </Spotlight>
        </section>
      </main>
    </div>
  );
}
