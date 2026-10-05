/**
 * The core loop, one tick at a time:
 *   Ring event history -> new events stored (de-duplicated by Ring event id)
 *   -> snapshot -> vision -> stored result -> today's deliveries reconciled.
 *
 * Serverless-friendly: there is no long-running process. The dashboard calls
 * a tick every few seconds while open, a cron can call it, and
 * `npm run poller` runs it in a loop for a always-on box.
 */

import type { Db } from "./db/client";
import {
  eventsBetween,
  getShop,
  insertEvents,
  listCameras,
  listExpected,
  putSnapshot,
  replaceDeliveryLog,
  claimUnprocessed,
  countUnprocessed,
  eventIdsNear,
  releaseClaim,
  saveVision,
  setCameraCursor,
} from "./db/repo";
import { now } from "./clock";
import { getRingClient } from "./ring";
import { RingAuthError, type RingClient } from "./ring/types";
import { analyse } from "./vision";
import { buildVisits, reconcileDay } from "./brains/back";
import { localParts, zonedToUtc } from "./domain/time";

const MAX_VISION_PER_TICK = Number(process.env.MAX_VISION_PER_TICK || 24);
const VISION_CONCURRENCY = 6;
/**
 * Re-read this much history before the cursor on every poll. An event can
 * appear in Ring's history after a newer one (still uploading); ids are
 * de-duplicated, so the overlap costs nothing but catches those.
 */
const LOOKBACK_MS = 15 * 60_000;

export interface TickResult {
  fetched: number;
  processed: number;
  remaining: number;
  error?: string;
  authExpired?: boolean;
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

const g = globalThis as unknown as { __shopsenseTick?: Promise<TickResult> };

/** One tick at a time per process; overlapping callers share the running one. */
export function tick(db: Db, opts: { ring?: RingClient | null } = {}): Promise<TickResult> {
  g.__shopsenseTick ??= runTick(db, opts).finally(() => (g.__shopsenseTick = undefined));
  return g.__shopsenseTick;
}

async function runTick(db: Db, opts: { ring?: RingClient | null }): Promise<TickResult> {
  const nowD = await now(db);
  const shop = await getShop(db);
  const ring = opts.ring !== undefined ? opts.ring : await getRingClient(db, nowD.getTime());
  if (!ring) return { fetched: 0, processed: 0, remaining: 0, error: "Ring account not linked" };

  let fetched = 0;
  try {
    for (const cam of await listCameras(db)) {
      if (cam.role === "ignore" || cam.source !== ring.kind) continue;
      // First poll of a camera: only the last two hours, not its whole history.
      const since = cam.cursorMs ? cam.cursorMs - (ring.kind === "ring" ? LOOKBACK_MS : 0) : nowD.getTime() - 2 * 3600_000;
      let events = await ring.listEvents(cam.id, since);
      if (ring.kind === "ring" && events.length) {
        // A webhook may already have stored this motion under a different id.
        const known = new Set((await eventIdsNear(db, cam.id, events.map((e) => e.start))));
        events = events.filter((e) => !known.has(e.start));
      }
      if (!events.length) continue;
      const fresh = await insertEvents(db, events.map((e) => ({
        id: e.id,
        cameraId: cam.id,
        occurredAt: new Date(e.start).toISOString(),
        endedAt: e.end ? new Date(e.end).toISOString() : null,
        eventType: e.eventType,
        subType: e.subType,
        raw: e.raw ?? null,
      })));
      fetched += fresh.length;
      await setCameraCursor(db, cam.id, Math.max(...events.map((e) => e.start)));
    }
  } catch (err) {
    if (err instanceof RingAuthError) return { fetched, processed: 0, remaining: 0, error: err.message, authExpired: true };
    throw err;
  }

  const batch = await claimUnprocessed(db, MAX_VISION_PER_TICK);
  let processed = 0;
  await pool(batch, VISION_CONCURRENCY, async (ev) => {
    const ringEvent = { id: ev.id, deviceId: ev.cameraId, eventType: "motion", subType: ev.subType, start: Date.parse(ev.occurredAt), end: null, raw: ev.raw };
    let snap: Awaited<ReturnType<RingClient["getSnapshot"]>> | undefined;
    const snapshot = async () => (snap ??= await ring.getSnapshot(ringEvent));
    try {
      const out = await analyse({
        eventId: ev.id,
        role: ev.role,
        subType: ev.subType,
        raw: ev.raw,
        snapshot,
        staffHint: shop.staffHint,
        ageMs: nowD.getTime() - Date.parse(ev.occurredAt),
      });
      if (!out) {
        await releaseClaim(db, ev.id); // snapshot not ready yet: try again next tick
        return;
      }
      await saveVision(db, ev.id, out.vision, out.provider);
      // Keep back-door JPEGs as delivery proof; front-door images are dropped.
      if (ev.role === "back" && snap && snap.mime === "image/jpeg" && out.vision.kind === "back" && out.vision.isDelivery) {
        await putSnapshot(db, ev.id, snap.mime, snap.bytes);
      }
      processed++;
    } catch (err) {
      console.warn(`[poller] vision failed for ${ev.id}:`, (err as Error).message);
      await releaseClaim(db, ev.id);
    }
  });

  if (processed > 0) {
    const today = localParts(nowD, shop.timezone).date;
    const dayStart = zonedToUtc(today, 0, shop.timezone);
    const events = await eventsBetween(db, dayStart, nowD);
    if (!(await listCameras(db)).some((c) => c.role === "back")) return { fetched, processed, remaining: 0 };
    const records = reconcileDay(today, buildVisits(events), await listExpected(db), shop.timezone, nowD);
    await replaceDeliveryLog(db, today, records).catch((err) => console.warn("[poller] delivery log:", err.message));
  }

  return { fetched, processed, remaining: batch.length === MAX_VISION_PER_TICK ? await countUnprocessed(db) : 0 };
}
