import { describe, expect, it } from "vitest";
import { memoryDb } from "./db/client";
import { seedDemo } from "./sim/seed";
import { tick } from "./poller";
import { computeDashboard } from "./dashboard";
import { getAdviceFor, templateAdvice } from "./advice";
import { setReplay } from "./clock";
import { upsertSales } from "./db/repo";
import { zonedToUtc } from "./domain/time";
import { SIM_TZ } from "./sim/scenario";

describe("end-to-end pipeline on the demo shop", () => {
  it("seeds, polls, and builds a dashboard", { timeout: 120_000 }, async () => {
    process.env.BEDROCK_DISABLED = "1";
    const db = await memoryDb();
    const t0 = Date.now();
    const seeded = await seedDemo(db, { today: "2026-10-03" }); // a Saturday
    expect(seeded.events).toBeGreaterThan(5000);
    const seedMs = Date.now() - t0;

    // Jump the replay clock to 1pm and drain the poller.
    await setReplay(db, { at: zonedToUtc("2026-10-03", 13 * 60, SIM_TZ).getTime(), paused: true });
    let processed = 0;
    for (let i = 0; i < 30; i++) {
      const r = await tick(db);
      processed += r.processed;
      if (r.remaining === 0 && r.processed === 0) break;
    }
    expect(processed).toBeGreaterThan(50);

    const t1 = Date.now();
    const d = await computeDashboard(db);
    const dashMs = Date.now() - t1;
    expect(d.clock.local).toBe("13:00");
    expect(d.today.visitors).toBeGreaterThan(40);
    expect(d.today.busyHours).toContain(12);
    expect(d.deliveries.today.find((r) => r.supplier === "Roti Harian Bakery")?.status).toBe("on_time");
    expect(d.deliveries.today.find((r) => r.supplier === "Segar Fresh Produce")?.arrived).toMatch(/^12:/);
    expect(d.insights[0].kind).toBe("delivery_in_rush");
    expect(d.feed.length).toBeGreaterThan(5);

    await upsertSales(db, { date: "2026-10-03", salesTotal: 1400, buyerCount: 80 });
    const d2 = await computeDashboard(db, "ms");
    expect(d2.today.conversion).toBeGreaterThan(0);
    const advice = templateAdvice(d2, "ms");
    expect(advice.length).toBeGreaterThanOrEqual(2);
    const a = await getAdviceFor(db, d2, "ms");
    expect(a.provider).toBe("template");
    console.warn(JSON.stringify({ seedMs, dashMs, advice: templateAdvice(d, "en"), alerts: d.alerts, insights: d.insights.map((i) => i.title) }, null, 1));
  });
});
