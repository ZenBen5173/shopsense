/** Data access. Every query lives here so the brains never see SQL. */

import type { Db } from "./client";
import type {
  Camera,
  CameraRole,
  DeliveryRecord,
  ExpectedDelivery,
  SalesDay,
  ShopProfile,
  StoredEvent,
  VisionResult,
} from "../domain/types";

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
// Both drivers hand back JSONB already parsed.
const json = <T>(v: unknown): T | null => (v == null ? null : (v as T));

/* ---------------------------------------------------------------- settings */

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const rows = await db.query<{ value: unknown }>("SELECT value FROM settings WHERE key = $1", [key]);
  return rows.length ? (json<T>(rows[0].value) ?? fallback) : fallback;
}

export async function setSetting(db: Db, key: string, value: unknown) {
  await db.query(
    "INSERT INTO settings (key, value) VALUES ($1, $2::text::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, JSON.stringify(value)],
  );
}

export const DEFAULT_SHOP: ShopProfile = {
  name: "My Shop",
  timezone: "Asia/Kuala_Lumpur",
  openAt: 8 * 60,
  closeAt: 21 * 60,
  staffHint: "",
  currency: "RM",
  lang: "en",
};

export async function getShop(db: Db): Promise<ShopProfile> {
  return { ...DEFAULT_SHOP, ...(await getSetting<Partial<ShopProfile>>(db, "shop", {})) };
}

/* ----------------------------------------------------------------- cameras */

export async function listCameras(db: Db): Promise<(Camera & { cursorMs: number })[]> {
  const rows = await db.query<{ id: string; name: string; role: CameraRole; source: "sim" | "ring"; cursor_ms: unknown }>(
    "SELECT id, name, role, source, cursor_ms FROM cameras ORDER BY created_at, id",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, source: r.source, cursorMs: Number(r.cursor_ms) }));
}

export async function upsertCamera(db: Db, c: Camera) {
  await db.query(
    `INSERT INTO cameras (id, name, role, source) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, source = EXCLUDED.source`,
    [c.id, c.name, c.role, c.source],
  );
}

export async function setCameraRole(db: Db, id: string, role: CameraRole) {
  await db.query("UPDATE cameras SET role = $2 WHERE id = $1", [id, role]);
}

export async function setCameraCursor(db: Db, id: string, cursorMs: number) {
  await db.query("UPDATE cameras SET cursor_ms = GREATEST(cursor_ms, $2) WHERE id = $1", [id, Math.round(cursorMs)]);
}

/* ------------------------------------------------------------------ events */

export interface NewEvent {
  id: string;
  cameraId: string;
  occurredAt: string;
  endedAt?: string | null;
  eventType?: string | null;
  subType?: string | null;
  snapshotUrl?: string | null;
  vision?: VisionResult | null;
  provider?: string | null;
  raw?: unknown;
}

/** Inserts, skipping ids already stored. Returns the ids that were new. */
export async function insertEvents(db: Db, events: NewEvent[]): Promise<string[]> {
  const fresh: string[] = [];
  const COLS = 11;
  for (let i = 0; i < events.length; i += 400) {
    const chunk = events.slice(i, i + 400);
    const params: unknown[] = [];
    const values = chunk.map((e, j) => {
      params.push(
        e.id, e.cameraId, e.occurredAt, e.endedAt ?? null, e.eventType ?? null, e.subType ?? null,
        e.snapshotUrl ?? null, e.vision ? JSON.stringify(e.vision) : null, e.provider ?? null,
        e.raw === undefined ? null : JSON.stringify(e.raw),
        e.vision ? new Date().toISOString() : null,
      );
      const b = j * COLS;
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}::text::jsonb, $${b + 9}, $${b + 10}::text::jsonb, $${b + 11}::timestamptz)`;
    });
    const rows = await db.query<{ id: string }>(
      `INSERT INTO events (id, camera_id, occurred_at, ended_at, event_type, sub_type, snapshot_url, vision_result, vision_provider, raw, processed_at)
       VALUES ${values.join(", ")} ON CONFLICT (id) DO NOTHING RETURNING id`,
      params,
    );
    fresh.push(...rows.map((r) => r.id));
  }
  return fresh;
}

type EventRow = { id: string; camera_id: string; role: CameraRole; occurred_at: unknown; vision_result: unknown; vision_provider: string | null };

const toEvent = (r: EventRow): StoredEvent => ({
  id: r.id,
  cameraId: r.camera_id,
  role: r.role,
  occurredAt: iso(r.occurred_at),
  vision: json<VisionResult>(r.vision_result),
  provider: r.vision_provider,
});

/** Processed events between two instants, with each camera's current role. */
export async function eventsBetween(db: Db, from: Date, to: Date): Promise<StoredEvent[]> {
  const rows = await db.query<EventRow>(
    `SELECT e.id, e.camera_id, c.role, e.occurred_at, e.vision_result, e.vision_provider
       FROM events e JOIN cameras c ON c.id = e.camera_id
      WHERE e.occurred_at >= $1 AND e.occurred_at <= $2 AND e.vision_result IS NOT NULL
      ORDER BY e.occurred_at`,
    [from.toISOString(), to.toISOString()],
  );
  return rows.map(toEvent);
}

export async function recentEvents(db: Db, before: Date, limit: number) {
  const rows = await db.query<EventRow & { camera_name: string; snapshot_url: string | null }>(
    `SELECT e.id, e.camera_id, c.role, c.name AS camera_name, e.occurred_at, e.vision_result, e.vision_provider, e.snapshot_url
       FROM events e JOIN cameras c ON c.id = e.camera_id
      WHERE e.occurred_at <= $1 AND e.vision_result IS NOT NULL AND c.role <> 'ignore'
      ORDER BY e.occurred_at DESC LIMIT $2`,
    [before.toISOString(), limit],
  );
  return rows.map((r) => ({ ...toEvent(r), cameraName: r.camera_name, snapshotUrl: r.snapshot_url }));
}

/**
 * Claim up to `limit` events that still need vision. processed_at doubles as
 * a claim timestamp: a claim older than two minutes (a crashed tick) is taken
 * over. SKIP LOCKED keeps concurrent ticks from grabbing the same rows.
 */
export async function claimUnprocessed(db: Db, limit: number) {
  const rows = await db.query<{ id: string; camera_id: string; role: CameraRole; occurred_at: unknown; raw: unknown; snapshot_url: string | null; sub_type: string | null }>(
    `WITH picked AS (
       SELECT e.id FROM events e JOIN cameras c ON c.id = e.camera_id
        WHERE e.vision_result IS NULL AND c.role <> 'ignore'
          AND (e.processed_at IS NULL OR e.processed_at < now() - interval '2 minutes')
        ORDER BY e.occurred_at
        LIMIT $1
        FOR UPDATE OF e SKIP LOCKED
     )
     UPDATE events e SET processed_at = now()
       FROM picked, cameras c
      WHERE e.id = picked.id AND c.id = e.camera_id
     RETURNING e.id, e.camera_id, c.role, e.occurred_at, e.raw, e.snapshot_url, e.sub_type`,
    [limit],
  );
  return rows
    .map((r) => ({ id: r.id, cameraId: r.camera_id, role: r.role, occurredAt: iso(r.occurred_at), raw: json<unknown>(r.raw), snapshotUrl: r.snapshot_url, subType: r.sub_type }))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

/** Give a claimed event back (e.g. its snapshot isn't ready yet), to retry on a later tick. */
export async function releaseClaim(db: Db, id: string) {
  await db.query("UPDATE events SET processed_at = NULL WHERE id = $1 AND vision_result IS NULL", [id]);
}

export async function countUnprocessed(db: Db): Promise<number> {
  const rows = await db.query<{ n: unknown }>(
    "SELECT count(*) AS n FROM events e JOIN cameras c ON c.id = e.camera_id WHERE e.vision_result IS NULL AND c.role <> 'ignore'",
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Of `startsMs`, the ones that already have a stored event on this camera
 * within a few seconds under a DIFFERENT moment-identity (webhook vs history).
 * Returns the matching starts so the poller can skip them.
 */
export async function eventIdsNear(db: Db, cameraId: string, startsMs: number[], windowMs = 3000): Promise<number[]> {
  if (!startsMs.length) return [];
  const min = Math.min(...startsMs) - windowMs;
  const max = Math.max(...startsMs) + windowMs;
  const rows = await db.query<{ occurred_at: unknown; raw: unknown }>(
    "SELECT occurred_at, raw FROM events WHERE camera_id = $1 AND occurred_at BETWEEN $2 AND $3",
    [cameraId, new Date(min).toISOString(), new Date(max).toISOString()],
  );
  // Only webhook-born rows count: a history row with the same id is deduped by its primary key anyway.
  const webhookTimes = rows
    .filter((r) => (r.raw as { meta?: unknown } | null)?.meta !== undefined)
    .map((r) => Date.parse(iso(r.occurred_at)));
  return startsMs.filter((t) => webhookTimes.some((w) => Math.abs(w - t) <= windowMs));
}

/** A webhook event for this camera within a few seconds of `atMs` is already stored. */
export async function hasEventNear(db: Db, cameraId: string, atMs: number, windowMs = 3000) {
  const rows = await db.query<{ id: string }>(
    "SELECT id FROM events WHERE camera_id = $1 AND occurred_at BETWEEN $2 AND $3 LIMIT 1",
    [cameraId, new Date(atMs - windowMs).toISOString(), new Date(atMs + windowMs).toISOString()],
  );
  return rows.length > 0;
}

export async function saveVision(db: Db, id: string, vision: VisionResult, provider: string) {
  await db.query(
    "UPDATE events SET vision_result = $2::text::jsonb, vision_provider = $3, processed_at = now() WHERE id = $1",
    [id, JSON.stringify(vision), provider],
  );
}

/** Save many vision results in one statement. */
export async function saveVisionBatch(db: Db, rows: { id: string; vision: VisionResult; provider: string }[]) {
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000).map((r) => ({ id: r.id, v: r.vision, p: r.provider }));
    await db.query(
      `UPDATE events e SET vision_result = x.v, vision_provider = x.p, processed_at = now()
         FROM jsonb_to_recordset($1::text::jsonb) AS x(id text, v jsonb, p text)
        WHERE e.id = x.id`,
      [JSON.stringify(chunk)],
    );
  }
}

export async function getEventRaw(db: Db, id: string) {
  const rows = await db.query<{ raw: unknown; occurred_at: unknown; camera_id: string }>(
    "SELECT raw, occurred_at, camera_id FROM events WHERE id = $1",
    [id],
  );
  return rows[0] ? { raw: json<unknown>(rows[0].raw), occurredAt: iso(rows[0].occurred_at), cameraId: rows[0].camera_id } : null;
}

export async function countEvents(db: Db): Promise<number> {
  const rows = await db.query<{ n: unknown }>("SELECT count(*) AS n FROM events");
  return Number(rows[0]?.n ?? 0);
}

/* --------------------------------------------------------------- snapshots */

export async function putSnapshot(db: Db, eventId: string, mime: string, data: Uint8Array) {
  await db.query(
    "INSERT INTO snapshots (event_id, mime, data) VALUES ($1, $2, $3) ON CONFLICT (event_id) DO NOTHING",
    [eventId, mime, data],
  );
}

export async function getSnapshot(db: Db, eventId: string) {
  const rows = await db.query<{ mime: string; data: Uint8Array }>("SELECT mime, data FROM snapshots WHERE event_id = $1", [eventId]);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------- sales */

export async function upsertSales(db: Db, s: SalesDay, source = "owner") {
  await db.query(
    `INSERT INTO sales (date, sales_total, buyer_count, source) VALUES ($1, $2, $3, $4)
     ON CONFLICT (date) DO UPDATE SET sales_total = EXCLUDED.sales_total, buyer_count = EXCLUDED.buyer_count, source = EXCLUDED.source`,
    [s.date, s.salesTotal, s.buyerCount, source],
  );
}

export async function listSales(db: Db, from: string, to: string): Promise<SalesDay[]> {
  const rows = await db.query<{ date: unknown; sales_total: unknown; buyer_count: unknown }>(
    "SELECT date::text AS date, sales_total, buyer_count FROM sales WHERE date BETWEEN $1 AND $2 ORDER BY date",
    [from, to],
  );
  return rows.map((r) => ({ date: String(r.date).slice(0, 10), salesTotal: Number(r.sales_total), buyerCount: Number(r.buyer_count) }));
}

/* -------------------------------------------------------------- deliveries */

export async function listExpected(db: Db): Promise<ExpectedDelivery[]> {
  const rows = await db.query<{ id: number; supplier_name: string; expected_day: number; expected_window_start: number; expected_window_end: number }>(
    "SELECT * FROM deliveries_expected ORDER BY expected_day, expected_window_start",
  );
  return rows.map((r) => ({
    id: Number(r.id),
    supplierName: r.supplier_name,
    weekday: Number(r.expected_day),
    windowStart: Number(r.expected_window_start),
    windowEnd: Number(r.expected_window_end),
  }));
}

export async function addExpected(db: Db, x: Omit<ExpectedDelivery, "id">) {
  const rows = await db.query<{ id: number }>(
    `INSERT INTO deliveries_expected (supplier_name, expected_day, expected_window_start, expected_window_end)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [x.supplierName, x.weekday, x.windowStart, x.windowEnd],
  );
  return Number(rows[0].id);
}

export async function deleteExpected(db: Db, id: number) {
  await db.query("DELETE FROM deliveries_expected WHERE id = $1", [id]);
}

/** Materialise one day's reconciled deliveries into deliveries_log. */
/**
 * Materialise one day's reconciled deliveries into deliveries_log, for SQL
 * reporting outside the app. One statement, so concurrent ticks can't
 * interleave a delete with another tick's inserts.
 */
export async function replaceDeliveryLog(db: Db, date: string, records: DeliveryRecord[]) {
  const rows = records.map((r) => ({
    expected_id: r.expected?.id ?? null,
    event_id: r.visit?.eventIds[0] ?? null,
    supplier_detected: r.visit?.supplierDetected ?? null,
    arrived_at: r.visit?.arrivedAt ?? null,
    duration: r.visit?.durationMin ?? null,
    status: r.status,
  }));
  await db.query(
    `WITH gone AS (DELETE FROM deliveries_log WHERE date = $1::date)
     INSERT INTO deliveries_log (date, expected_id, event_id, supplier_detected, arrived_at, duration, status)
     SELECT $1::date, x.expected_id, x.event_id, x.supplier_detected, x.arrived_at, x.duration, x.status
       FROM jsonb_to_recordset($2::text::jsonb)
         AS x(expected_id int, event_id text, supplier_detected text, arrived_at timestamptz, duration int, status text)`,
    [date, JSON.stringify(rows)],
  );
}

/* ------------------------------------------------------------------ advice */

export async function getAdvice(db: Db, hash: string, lang: string) {
  const rows = await db.query<{ body: string; provider: string; created_at: unknown }>(
    "SELECT body, provider, created_at FROM advice_cache WHERE facts_hash = $1 AND lang = $2",
    [hash, lang],
  );
  return rows[0] ? { body: rows[0].body, provider: rows[0].provider, createdAt: iso(rows[0].created_at) } : null;
}

export async function putAdvice(db: Db, hash: string, lang: string, body: string, provider: string) {
  await db.query(
    `INSERT INTO advice_cache (facts_hash, lang, body, provider) VALUES ($1, $2, $3, $4)
     ON CONFLICT (facts_hash, lang) DO UPDATE SET body = EXCLUDED.body, provider = EXCLUDED.provider, created_at = now()`,
    [hash, lang, body, provider],
  );
}

/* ------------------------------------------------------------------- oauth */

export async function putOauthState(db: Db, state: string, verifier: string) {
  await db.query("INSERT INTO oauth_state (state, verifier) VALUES ($1, $2)", [state, verifier]);
}

export async function takeOauthState(db: Db, state: string) {
  const rows = await db.query<{ verifier: string }>(
    "DELETE FROM oauth_state WHERE state = $1 AND created_at > now() - interval '15 minutes' RETURNING verifier",
    [state],
  );
  return rows[0]?.verifier ?? null;
}

/** Remove the demo shop's data but keep the Ring link (used when switching to a real account). */
export async function clearDemoData(db: Db) {
  await db.exec(`
    DELETE FROM cameras WHERE source = 'sim';
    DELETE FROM sales WHERE source = 'demo';
    DELETE FROM advice_cache;
    DELETE FROM deliveries_log;
  `);
  const demo = await db.query<{ key: string }>("DELETE FROM settings WHERE key = 'demo' RETURNING key");
  if (demo.length) {
    // The supplier list and shop profile were the demo's, not the owner's.
    await db.exec("DELETE FROM deliveries_expected");
    const shop = await getShop(db);
    await setSetting(db, "shop", { ...DEFAULT_SHOP, timezone: shop.timezone, currency: shop.currency, lang: shop.lang });
  }
}

/** Wipe everything (used by "reset demo"). */
export async function resetAll(db: Db) {
  await db.exec(
    "TRUNCATE snapshots, deliveries_log, events, sales, deliveries_expected, advice_cache, oauth_state, cameras, settings RESTART IDENTITY CASCADE",
  );
}
