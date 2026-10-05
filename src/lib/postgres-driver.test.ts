/**
 * The same pipeline as pipeline.test.ts, but through postgres.js over the
 * Postgres wire protocol (as with Supabase), not PGlite's in-process API.
 * Catches driver differences such as JSONB parameters being encoded twice.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = 54329;
let server: PGLiteSocketServer;

beforeAll(async () => {
  const pg = await PGlite.create();
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1" });
  await server.start();
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  process.env.BEDROCK_DISABLED = "1";
  process.env.PG_POOL_MAX = "1"; // the test server speaks to one client at a time
});

afterAll(async () => {
  delete process.env.DATABASE_URL;
  await server?.stop();
});

describe("postgres.js driver (Supabase path)", () => {
  it("stores settings and vision JSON as objects, and builds a dashboard", { timeout: 120_000 }, async () => {
    const { getDb } = await import("./db/client");
    const { getSetting, setSetting } = await import("./db/repo");
    const { seedDemo } = await import("./sim/seed");
    const { tick } = await import("./poller");
    const { setReplay } = await import("./clock");
    const { computeDashboard } = await import("./dashboard");
    const { zonedToUtc } = await import("./domain/time");

    const db = await getDb();
    expect(db.kind).toBe("postgres");

    await setSetting(db, "probe", { a: 1, b: "x" });
    expect(await getSetting(db, "probe", null)).toEqual({ a: 1, b: "x" });
    await setSetting(db, "probe", "sim");
    expect(await getSetting(db, "probe", null)).toBe("sim");

    await seedDemo(db, { today: "2026-10-03", days: 14 });
    await setReplay(db, { at: zonedToUtc("2026-10-03", 12 * 60 + 40, "Asia/Kuala_Lumpur").getTime(), paused: true });
    for (let i = 0; i < 15; i++) {
      const r = await tick(db);
      if (!r.remaining && !r.processed) break;
    }
    const rows = await db.query<{ v: unknown }>("SELECT vision_result AS v FROM events WHERE vision_result IS NOT NULL LIMIT 1");
    expect(typeof rows[0].v).toBe("object");

    const d = await computeDashboard(db);
    expect(d.clock.local).toBe("12:40");
    expect(d.today.visitors).toBeGreaterThan(30);
    expect(d.deliveries.today.some((r) => r.supplier === "Segar Fresh Produce" && r.status === "on_time")).toBe(true);
    const log = await db.query<{ n: unknown }>("SELECT count(*) AS n FROM deliveries_log");
    expect(Number(log[0].n)).toBeGreaterThan(0);
  });
});
