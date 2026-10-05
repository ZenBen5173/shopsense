/**
 * A Ring client backed by the shop simulator. It answers the same calls as
 * the Partner API, revealing each event only once the (simulated) clock has
 * passed it, so the poller and dashboard behave exactly as they would live.
 */

import { generateDay, SIM_DEVICES, SIM_TZ, type SimDay, type SimEvent } from "../sim/scenario";
import { renderSnapshotSvg } from "../sim/snapshot";
import { addDays, localParts } from "../domain/time";
import type { RingClient, RingDevice, RingEvent, Snapshot } from "./types";

const dayCache = new Map<string, SimDay>();

export function simDay(date: string): SimDay {
  let d = dayCache.get(date);
  if (!d) {
    d = generateDay(date);
    if (dayCache.size > 120) dayCache.clear();
    dayCache.set(date, d);
  }
  return d;
}

export function toRingEvent(e: SimEvent): RingEvent {
  return { id: e.id, deviceId: e.deviceId, eventType: e.eventType, subType: e.subType, start: e.start, end: e.end, raw: { sim: true, truth: e.truth } };
}

export class SimRingClient implements RingClient {
  readonly kind = "sim" as const;

  constructor(private nowMs: number) {}

  async listDevices(): Promise<RingDevice[]> {
    return [SIM_DEVICES.front, SIM_DEVICES.back].map((d) => ({ id: d.id, name: d.name }));
  }

  async listEvents(deviceId: string, sinceMs: number): Promise<RingEvent[]> {
    const end = localParts(this.nowMs, SIM_TZ).date;
    // Never reach back more than two days: history is seeded separately.
    let date = localParts(Math.max(sinceMs, this.nowMs - 2 * 86_400_000), SIM_TZ).date;
    const out: RingEvent[] = [];
    while (date <= end) {
      for (const e of simDay(date).events) {
        if (e.deviceId === deviceId && e.start > sinceMs && e.start <= this.nowMs) out.push(toRingEvent(e));
      }
      date = addDays(date, 1);
    }
    return out;
  }

  async getSnapshot(event: RingEvent): Promise<Snapshot | null> {
    const date = localParts(event.start, SIM_TZ).date;
    const e = simDay(date).events.find((x) => x.id === event.id);
    if (!e) return null;
    return { mime: "image/svg+xml", bytes: new TextEncoder().encode(renderSnapshotSvg(e)) };
  }
}
