/**
 * Loads the demo shop: four weeks of processed history (as if ShopSense had
 * been running for a month), the owner's supplier list, past sales — and a
 * replay clock parked on the morning of "today", so the day unfolds live.
 */

import type { Db } from "../db/client";
import { addExpected, insertEvents, resetAll, setSetting, upsertCamera, upsertSales, setCameraCursor, type NewEvent } from "../db/repo";
import { setReplay } from "../clock";
import { addDays, localParts, zonedToUtc } from "../domain/time";
import { perceive } from "../vision/sim";
import { SIM_DEVICES, SIM_SHOP, SIM_SUPPLIERS, SIM_TZ } from "./scenario";
import { simDay } from "../ring/sim";

export interface SeedOptions {
  /** Shop-local date to treat as today. Defaults to the real date in KL. */
  today?: string;
  days?: number;
  /** Minutes after midnight the replay starts at. */
  startAt?: number;
  speed?: number;
}

export async function seedDemo(db: Db, opts: SeedOptions = {}) {
  const today = opts.today ?? localParts(Date.now(), SIM_TZ).date;
  const days = opts.days ?? 28;
  const startAt = opts.startAt ?? 9 * 60 + 30;

  await resetAll(db);
  await setSetting(db, "source", "sim");
  await setSetting(db, "shop", { name: SIM_SHOP.name, timezone: SIM_TZ, openAt: SIM_SHOP.openAt, closeAt: SIM_SHOP.closeAt, staffHint: SIM_SHOP.staffHint, currency: SIM_SHOP.currency, lang: "en" });
  await setSetting(db, "demo", { today, seededAt: new Date().toISOString() });
  await upsertCamera(db, { id: SIM_DEVICES.front.id, name: SIM_DEVICES.front.name, role: "front", source: "sim" });
  await upsertCamera(db, { id: SIM_DEVICES.back.id, name: SIM_DEVICES.back.name, role: "back", source: "sim" });
  for (const s of SIM_SUPPLIERS) {
    for (const wd of s.weekdays) await addExpected(db, { supplierName: s.name, weekday: wd, windowStart: s.windowStart, windowEnd: s.windowEnd });
  }

  const rows: NewEvent[] = [];
  for (let i = days; i >= 1; i--) {
    const date = addDays(today, -i);
    const day = simDay(date);
    for (const e of day.events) {
      rows.push({
        id: e.id,
        cameraId: e.deviceId,
        occurredAt: new Date(e.start).toISOString(),
        endedAt: new Date(e.end).toISOString(),
        eventType: e.eventType,
        subType: e.subType,
        vision: perceive(e.id, e.truth),
        provider: "sim-perception",
        raw: { sim: true, truth: e.truth },
      });
    }
    await upsertSales(db, { date, salesTotal: day.salesTotal, buyerCount: day.buyers }, "demo");
  }
  await insertEvents(db, rows);

  // Today's events arrive through the normal poller as the replay clock runs.
  const dayStart = zonedToUtc(today, 0, SIM_TZ).getTime();
  await setCameraCursor(db, SIM_DEVICES.front.id, dayStart);
  await setCameraCursor(db, SIM_DEVICES.back.id, dayStart);
  await setReplay(db, { at: zonedToUtc(today, startAt, SIM_TZ).getTime(), speed: opts.speed ?? 60, paused: false });

  return { today, events: rows.length };
}
