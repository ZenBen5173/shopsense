/**
 * The demo shop: "Kedai Runcit Ah Kow", a neighbourhood grocery in Kuala
 * Lumpur with one camera on the front door and one on the back lane.
 *
 * Every day is generated from a seed (the date), so a replay is identical
 * every time and the numbers on the dashboard are reproducible in a demo.
 *
 * The scenario plants three real stories for the brains to find, without the
 * brains being told about them:
 *  1. Saturday lunch is the busiest hour of the week.
 *  2. Segar Fresh Produce delivers on Saturdays at about 12:15 — technically
 *     inside its grace period, but right in that busiest hour.
 *  3. Ah Seng Drinks is often late on Thursdays; the fridge runs low before
 *     lunch and fewer visitors buy on those days.
 */

import { rng, type Rng } from "./random";
import { weekdayOf, zonedToUtc } from "../domain/time";

export const SIM_TZ = "Asia/Kuala_Lumpur";
export const SIM_DEVICES = {
  front: { id: "ava1.ring.device.SIMFRONT01", name: "Front Door" },
  back: { id: "ava1.ring.device.SIMBACK01", name: "Back Lane" },
} as const;

export const SIM_SHOP = {
  name: "Kedai Runcit Ah Kow",
  openAt: 7 * 60,
  closeAt: 22 * 60,
  staffHint: "red apron",
  currency: "RM",
};

export interface SimSupplier {
  name: string;
  weekdays: number[];
  windowStart: number;
  windowEnd: number;
  vehicle: string;
  colour: string;
  /** How the logo reads on the vehicle. */
  logo: string;
}

export const SIM_SUPPLIERS: SimSupplier[] = [
  { name: "Roti Harian Bakery", weekdays: [0, 1, 2, 3, 4, 5, 6], windowStart: 7 * 60, windowEnd: 7 * 60 + 45, vehicle: "white van", colour: "#f4f4f5", logo: "ROTI HARIAN" },
  { name: "Ah Seng Drinks Trading", weekdays: [1, 4], windowStart: 10 * 60, windowEnd: 11 * 60, vehicle: "blue lorry", colour: "#2563eb", logo: "AH SENG DRINKS" },
  { name: "Segar Fresh Produce", weekdays: [2, 5, 6], windowStart: 11 * 60, windowEnd: 12 * 60, vehicle: "green pickup", colour: "#16a34a", logo: "SEGAR FRESH" },
  { name: "Beras Wholesale KL", weekdays: [3], windowStart: 14 * 60, windowEnd: 16 * 60, vehicle: "yellow lorry", colour: "#eab308", logo: "BERAS KL" },
];

/** Customers per hour, by weekday. Index = hour of day. */
const BASE = [0, 0, 0, 0, 0, 0, 0, 8, 14, 9, 7, 10, 21, 19, 9, 8, 10, 15, 18, 14, 10, 6, 0, 0];
const PROFILE: Record<number, number[]> = {
  0: BASE.map((v, h) => (h < 10 ? v * 0.6 : h === 12 || h === 13 ? v * 1.15 : v * 0.95)),
  1: BASE,
  2: BASE.map((v) => v * 0.95),
  3: BASE.map((v) => v * 0.97),
  4: BASE.map((v) => v * 1.0),
  5: BASE.map((v, h) => (h >= 17 ? v * 1.2 : v * 1.05)),
  6: BASE.map((v, h) => (h === 12 ? v * 1.55 : h === 13 ? v * 1.4 : h === 11 ? v * 1.3 : h < 10 ? v * 0.7 : v * 1.1)),
};

const SHIRTS = ["#60a5fa", "#f472b6", "#a3e635", "#fbbf24", "#c084fc", "#2dd4bf", "#fb923c", "#e5e7eb", "#94a3b8"];

export interface FrontTruth {
  kind: "front";
  entering: number;
  leaving: number;
  staff: number;
  shirts: string[];
  /** Number of the entering people who are staff in aprons. */
}

export interface BackTruth {
  kind: "back";
  isDelivery: boolean;
  supplier: string | null;
  vehicle: string | null;
  logo: string | null;
  colour: string | null;
  phase: "arrive" | "unload" | "leave" | null;
  /** For non-deliveries: what actually moved. */
  what: "staff_rubbish" | "cat" | "motorbike" | null;
}

export interface SimEvent {
  id: string;
  deviceId: string;
  /** Epoch ms. */
  start: number;
  end: number;
  eventType: "motion";
  subType: "human" | "vehicle" | "other";
  truth: FrontTruth | BackTruth;
}

export interface SimDay {
  date: string;
  events: SimEvent[];
  customers: number;
  byHour: number[];
  buyers: number;
  salesTotal: number;
  stockout: boolean;
}

function groupSize(r: Rng) {
  const x = r.next();
  return x < 0.66 ? 1 : x < 0.91 ? 2 : 3;
}

interface Visit {
  supplier: SimSupplier;
  arriveMin: number;
  durationMin: number;
}

/** When (or whether) each supplier shows up on `date`. */
export function plannedVisits(date: string, r: Rng): { visits: Visit[]; stockout: boolean } {
  const wd = weekdayOf(date);
  const visits: Visit[] = [];
  let stockout = false;

  for (const s of SIM_SUPPLIERS) {
    if (!s.weekdays.includes(wd)) continue;
    let arrive: number | null = null;
    let duration = r.int(8, 16);

    switch (s.name) {
      case "Roti Harian Bakery":
        if (!r.chance(0.03)) arrive = s.windowStart + 5 + Math.max(0, r.normal(10, 7));
        duration = r.int(5, 9);
        break;
      case "Ah Seng Drinks Trading":
        if (wd === 4 && r.chance(0.65)) {
          arrive = 11 * 60 + 40 + r.int(0, 45); // Thursday: late, into lunch
          stockout = true;
        } else {
          arrive = s.windowStart + 15 + r.normal(5, 12);
        }
        break;
      case "Segar Fresh Produce":
        if (wd === 6) {
          arrive = 12 * 60 + 3 + r.int(0, 22); // Saturday: inside the grace, in the rush
          duration = r.int(14, 22);
        } else if (r.chance(0.06)) {
          stockout = true; // a rare no-show hurts fresh sales
        } else {
          arrive = s.windowStart + 10 + r.normal(5, 10);
        }
        break;
      case "Beras Wholesale KL":
        if (!r.chance(0.35)) arrive = s.windowStart + 25 + r.normal(5, 20);
        duration = r.int(12, 20);
        break;
    }
    if (arrive !== null) visits.push({ supplier: s, arriveMin: arrive, durationMin: duration });
  }
  return { visits, stockout };
}

export function generateDay(date: string, tz = SIM_TZ): SimDay {
  const r = rng(`shopsense:${date}`);
  const wd = weekdayOf(date);
  const rates = PROFILE[wd];
  const events: SimEvent[] = [];
  const at = (min: number) => zonedToUtc(date, min, tz).getTime();
  let seq = 0;
  const id = (tag: string) => `sim-${date}-${tag}-${String(seq++).padStart(4, "0")}`;

  const { visits, stockout } = plannedVisits(date, r);

  // Staff: two in red aprons open the shop and close it, one lunch break.
  const staffShirts = ["#dc2626", "#dc2626"];
  const front = SIM_DEVICES.front.id;
  const back = SIM_DEVICES.back.id;
  const frontEvent = (min: number, entering: number, leaving: number, staff: number, shirts: string[]) => {
    const start = at(min);
    events.push({
      id: id("f"),
      deviceId: front,
      start,
      end: start + 20_000 + r.int(0, 15_000),
      eventType: "motion",
      subType: "human",
      truth: { kind: "front", entering, leaving, staff, shirts },
    });
  };

  frontEvent(6 * 60 + 41 + r.int(0, 6), 2, 0, 2, staffShirts);
  frontEvent(14 * 60 + r.int(0, 10), 0, 1, 0, ["#dc2626"]);
  frontEvent(14 * 60 + 35 + r.int(0, 10), 1, 0, 1, ["#dc2626"]);
  frontEvent(22 * 60 + 6 + r.int(0, 8), 0, 2, 0, staffShirts);

  // Customers. Each group makes one motion event walking in and one walking out.
  const byHour = new Array(24).fill(0);
  for (let h = 0; h < 24; h++) {
    const lambda = rates[h];
    if (!lambda) continue;
    let people = r.poisson(lambda);
    while (people > 0) {
      const size = Math.min(people, groupSize(r));
      people -= size;
      const enterMin = h * 60 + r.next() * 59;
      const shirts = Array.from({ length: size }, () => r.pick(SHIRTS));
      frontEvent(enterMin, size, 0, 0, shirts);
      byHour[h] += size;
      const leaveMin = enterMin + 4 + r.next() * 18;
      if (leaveMin < 22 * 60 + 5) frontEvent(leaveMin, 0, size, 0, shirts);
    }
  }

  // Deliveries: arrive, unload, leave — three back-lane events per visit.
  for (const v of visits) {
    const s = v.supplier;
    const truth = (phase: BackTruth["phase"]): BackTruth => ({
      kind: "back",
      isDelivery: true,
      supplier: s.name,
      vehicle: s.vehicle,
      logo: s.logo,
      colour: s.colour,
      phase,
      what: null,
    });
    const phases: [number, BackTruth["phase"], SimEvent["subType"]][] = [
      [v.arriveMin, "arrive", "vehicle"],
      [v.arriveMin + v.durationMin * 0.45, "unload", "human"],
      [v.arriveMin + v.durationMin, "leave", "vehicle"],
    ];
    for (const [min, phase, subType] of phases) {
      const start = at(min);
      events.push({ id: id("b"), deviceId: back, start, end: start + 30_000, eventType: "motion", subType, truth: truth(phase) });
    }
  }

  // Back-lane noise: rubbish runs, the shop cat, motorbikes cutting through.
  const noise = r.int(2, 4);
  for (let i = 0; i < noise; i++) {
    const what = r.pick(["staff_rubbish", "cat", "motorbike"] as const);
    const start = at(8 * 60 + r.next() * 13 * 60);
    events.push({
      id: id("n"),
      deviceId: back,
      start,
      end: start + 12_000,
      eventType: "motion",
      subType: what === "cat" ? "other" : what === "motorbike" ? "vehicle" : "human",
      truth: { kind: "back", isDelivery: false, supplier: null, vehicle: what === "motorbike" ? "motorbike" : null, logo: null, colour: null, phase: null, what },
    });
  }

  events.sort((a, b) => a.start - b.start);

  // Sales: busy hours convert worse (queues), stockouts hurt the whole day.
  let buyers = 0;
  for (let h = 0; h < 24; h++) {
    const load = byHour[h];
    if (!load) continue;
    let conv = 0.66 - Math.max(0, load - 17) * 0.0075;
    if (stockout && h >= 11) conv *= 0.84;
    buyers += Math.max(0, Math.round(load * conv + r.normal(0, 0.6)));
  }
  const basket = 16.5 + r.normal(0, 1.2);
  const salesTotal = Math.round(buyers * basket * 100) / 100;
  const customers = byHour.reduce((a, b) => a + b, 0);

  return { date, events, customers, byHour, buyers, salesTotal, stockout };
}
