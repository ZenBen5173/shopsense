import { getDb, type Db } from "../db/client";
import { getSetting, listCameras } from "../db/repo";
import { getSource } from "../ring";
import { seedDemo } from "../sim/seed";
import { getClock, nowFrom } from "../clock";
import { zonedToUtc } from "../domain/time";
import { SIM_TZ } from "../sim/scenario";

const g = globalThis as unknown as { __shopsenseSeed?: Promise<unknown> };

/** After this time on the replayed day the shop has closed; the next visitor gets a fresh day. */
const DEMO_DAY_ENDS = 22 * 60 + 30;

/**
 * The database, with the demo shop loaded on first use when nothing is set up.
 *
 * The demo clock runs at up to 300x, so left alone it would be months ahead by
 * the time a judge visits. Once the replayed day is over, the demo starts a
 * fresh "today" (the real date in Kuala Lumpur) instead.
 */
export async function readyDb(): Promise<Db> {
  const db = await getDb();
  if ((await getSource(db)) !== "sim") return db;

  let needsSeed = (await listCameras(db)).length === 0;
  if (!needsSeed) {
    const demo = await getSetting<{ today?: string } | null>(db, "demo", null);
    if (demo?.today) {
      const ended = nowFrom(await getClock(db)) > zonedToUtc(demo.today, DEMO_DAY_ENDS, SIM_TZ).getTime();
      needsSeed = ended;
    }
  }
  if (needsSeed) {
    g.__shopsenseSeed ??= seedOnce(db).finally(() => (g.__shopsenseSeed = undefined));
    await g.__shopsenseSeed;
  }
  return db;
}

/**
 * Two instances on one shared database must not both seed. A settings row
 * acts as the lock: whoever inserts it seeds; the other waits until the new
 * day is in place.
 */
async function seedOnce(db: Db) {
  const got = await db.query(
    "INSERT INTO settings (key, value) VALUES ('seed_lock', to_jsonb(now()::text)) ON CONFLICT (key) DO NOTHING RETURNING key",
  );
  if (got.length) return seedDemo(db); // seedDemo's reset clears the lock row
  for (let i = 0; i < 60; i++) {
    const lock = await db.query("SELECT 1 FROM settings WHERE key = 'seed_lock'");
    if (!lock.length && (await listCameras(db)).length) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  // The other seeder died: take over.
  await db.query("DELETE FROM settings WHERE key = 'seed_lock'");
  return seedDemo(db);
}

export function jsonError(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[api]", message);
  return Response.json({ error: message }, { status });
}
