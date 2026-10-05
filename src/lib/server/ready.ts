import { getDb, type Db } from "../db/client";
import { listCameras } from "../db/repo";
import { getSource } from "../ring";
import { seedDemo } from "../sim/seed";

const g = globalThis as unknown as { __shopsenseSeed?: Promise<unknown> };

/** The database, with the demo shop loaded on first use when nothing is set up. */
export async function readyDb(): Promise<Db> {
  const db = await getDb();
  if ((await getSource(db)) === "sim" && (await listCameras(db)).length === 0) {
    g.__shopsenseSeed ??= seedOnce(db).finally(() => (g.__shopsenseSeed = undefined));
    await g.__shopsenseSeed;
  }
  return db;
}

/**
 * Two cold instances on one shared database must not both seed. A settings
 * row acts as the lock: whoever inserts it seeds; the other waits for cameras.
 */
async function seedOnce(db: Db) {
  const got = await db.query(
    "INSERT INTO settings (key, value) VALUES ('seed_lock', to_jsonb(now()::text)) ON CONFLICT (key) DO NOTHING RETURNING key",
  );
  if (got.length) return seedDemo(db); // seedDemo's reset clears the lock row
  for (let i = 0; i < 60; i++) {
    if ((await listCameras(db)).length) return;
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
