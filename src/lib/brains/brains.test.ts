import { describe, expect, it } from "vitest";
import { generateDay, SIM_DEVICES, SIM_SHOP, SIM_SUPPLIERS, SIM_TZ } from "../sim/scenario";
import { perceive } from "../vision/sim";
import type { ExpectedDelivery, SalesDay, StoredEvent } from "../domain/types";
import { addDays, localParts, zonedToUtc } from "../domain/time";
import { busyProfile, footfallByDate, weekCompare } from "./front";
import { buildVisits, nameScore, reconcileDay } from "./back";
import { allInsights } from "./link";

const TODAY = "2026-10-05"; // a Monday
const shop = { timezone: SIM_TZ, openAt: SIM_SHOP.openAt, closeAt: SIM_SHOP.closeAt };

function history(days = 28) {
  const events: StoredEvent[] = [];
  const sales: SalesDay[] = [];
  for (let i = days; i >= 1; i--) {
    const date = addDays(TODAY, -i);
    const day = generateDay(date);
    for (const e of day.events) {
      events.push({
        id: e.id,
        cameraId: e.deviceId,
        role: e.deviceId === SIM_DEVICES.front.id ? "front" : "back",
        occurredAt: new Date(e.start).toISOString(),
        vision: perceive(e.id, e.truth),
        provider: "sim",
      });
    }
    sales.push({ date, salesTotal: day.salesTotal, buyerCount: day.buyers });
  }
  return { events, sales };
}

const expected: ExpectedDelivery[] = SIM_SUPPLIERS.flatMap((s, i) =>
  s.weekdays.map((wd) => ({ id: i * 10 + wd, supplierName: s.name, weekday: wd, windowStart: s.windowStart, windowEnd: s.windowEnd })),
);

describe("time helpers", () => {
  it("converts KL local time to UTC and back", () => {
    const d = zonedToUtc("2026-10-05", 12 * 60 + 30, SIM_TZ);
    expect(d.toISOString()).toBe("2026-10-05T04:30:00.000Z");
    const p = localParts(d, SIM_TZ);
    expect(p.hour).toBe(12);
    expect(p.minute).toBe(30);
    expect(p.weekday).toBe(1);
  });
});

describe("simulator", () => {
  it("is deterministic per date", () => {
    expect(generateDay("2026-10-03").customers).toBe(generateDay("2026-10-03").customers);
  });
  it("makes Saturday lunch the busiest slot", () => {
    const sat = generateDay("2026-10-03");
    const mon = generateDay("2026-09-28");
    expect(Math.max(...sat.byHour)).toBeGreaterThan(Math.max(...mon.byHour));
  });
});

describe("front-door brain", () => {
  const { events, sales } = history();
  const foot = footfallByDate(events, shop);

  it("counts customers close to the truth, excluding staff", () => {
    const date = addDays(TODAY, -3);
    const truth = generateDay(date).customers;
    const got = foot.get(date)!;
    expect(Math.abs(got.total - truth)).toBeLessThanOrEqual(Math.max(got.band, 6));
  });

  it("finds Saturday 12pm as a busy hour", () => {
    const sat = busyProfile(foot, 6);
    expect(sat.busyHours).toContain(12);
    expect(sat.samples).toBe(4);
  });

  it("compares this week with last week", () => {
    const wc = weekCompare(foot, sales, TODAY);
    expect(wc.visitors).toBeGreaterThan(500);
    expect(wc.conversion).toBeGreaterThan(0.4);
    expect(wc.conversion).toBeLessThan(0.8);
  });
});

describe("back-door brain", () => {
  const { events } = history(14);
  const visits = buildVisits(events);

  it("ignores cats and motorbikes", () => {
    const backDeliveries = events.filter((e) => e.vision?.kind === "back" && e.vision.isDelivery);
    expect(visits.length).toBeGreaterThan(0);
    expect(visits.length).toBeLessThanOrEqual(backDeliveries.length / 2);
  });

  it("matches van logos to supplier names", () => {
    expect(nameScore("AH SENG DRINKS", "Ah Seng Drinks Trading")).toBe(1);
    expect(nameScore("SEGAR FRESH", "Segar Fresh Produce")).toBeGreaterThan(0.5);
    expect(nameScore("ROTI HARIAN", "Segar Fresh Produce")).toBe(0);
  });

  it("flags a late delivery and a missing one, never a pending one in the past", () => {
    const all = [];
    for (let i = 14; i >= 1; i--) {
      all.push(...reconcileDay(addDays(TODAY, -i), visits, expected, SIM_TZ, zonedToUtc(TODAY, 9 * 60, SIM_TZ)));
    }
    expect(all.some((r) => r.status === "pending")).toBe(false);
    expect(all.filter((r) => r.status === "on_time").length).toBeGreaterThan(10);
    const thursdays = all.filter((r) => r.expected?.supplierName === "Ah Seng Drinks Trading" && r.expected.weekday === 4);
    expect(thursdays.length).toBe(2);
  });

  it("marks today's later deliveries as pending, not missing", () => {
    const recs = reconcileDay(TODAY, [], expected, SIM_TZ, zonedToUtc(TODAY, 9 * 60, SIM_TZ));
    const ahSeng = recs.find((r) => r.expected?.supplierName === "Ah Seng Drinks Trading");
    expect(ahSeng?.status).toBe("pending");
    const roti = recs.find((r) => r.expected?.supplierName === "Roti Harian Bakery");
    expect(roti?.status).toBe("missing");
  });
});

describe("the link", () => {
  const { events, sales } = history(28);
  const foot = footfallByDate(events, shop);
  const visits = buildVisits(events);
  const records = [];
  for (let i = 28; i >= 1; i--) {
    records.push(...reconcileDay(addDays(TODAY, -i), visits, expected, SIM_TZ, zonedToUtc(TODAY, 9 * 60, SIM_TZ)));
  }
  const insights = allInsights({ tz: SIM_TZ, history: foot, records, sales, today: TODAY, openAt: SIM_SHOP.openAt, closeAt: SIM_SHOP.closeAt });

  it("finds the Saturday produce van in the lunch rush", () => {
    const rush = insights.find((i) => i.kind === "delivery_in_rush");
    expect(rush).toBeDefined();
    expect(rush!.facts.supplier).toBe("Segar Fresh Produce");
    expect(rush!.facts.weekday).toBe(6);
    expect(rush!.facts.busyHour).toBe(12);
  });

  it("finds that late Thursday drinks cost sales", () => {
    const dip = insights.find((i) => i.kind === "late_delivery_sales_dip");
    expect(dip).toBeDefined();
    expect(dip!.facts.supplier).toBe("Ah Seng Drinks Trading");
    expect(Number(dip!.facts.convGood)).toBeGreaterThan(Number(dip!.facts.convBad));
  });

  it("does not blame the rice lorry, whose no-shows do not hurt sales", () => {
    expect(insights.find((i) => i.kind === "late_delivery_sales_dip" && i.facts.supplier === "Beras Wholesale KL")).toBeUndefined();
  });

  it("ranks link insights first", () => {
    expect(insights[0].link).toBe(true);
  });
});
