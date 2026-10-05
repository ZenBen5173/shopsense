/**
 * Always-on poller for a server or a Raspberry Pi in the shop:
 *   npm run poller
 * Polls Ring every 15 s (the spec's interval) and runs vision on new events.
 * Needs DATABASE_URL so the dashboard and the poller share one database.
 */
import { getDb } from "../src/lib/db/client";
import { tick } from "../src/lib/poller";

const INTERVAL = Number(process.env.POLL_INTERVAL_MS || 15_000);

async function main() {
  if (!process.env.DATABASE_URL) console.warn("DATABASE_URL is not set: polling into a private in-memory database.");
  const db = await getDb();
  for (;;) {
    const started = Date.now();
    try {
      const r = await tick(db);
      if (r.fetched || r.processed || r.error) console.log(new Date().toISOString(), JSON.stringify(r));
      if (r.authExpired) console.warn("Ring token expired: re-link in Setup.");
    } catch (err) {
      console.error("tick failed:", (err as Error).message);
    }
    await new Promise((res) => setTimeout(res, Math.max(1000, INTERVAL - (Date.now() - started))));
  }
}

main();
