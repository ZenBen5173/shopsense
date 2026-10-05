/**
 * The app's notion of "now". Live mode is wall-clock time. Demo mode runs a
 * replay clock stored in the database as (anchor, speed), so every serverless
 * instance agrees on the simulated time without a background process.
 */

import type { Db } from "./db/client";
import { getSetting, setSetting } from "./db/repo";

export type Clock =
  | { mode: "live" }
  | { mode: "replay"; anchorReal: number; anchorSim: number; speed: number; paused?: boolean };

export async function getClock(db: Db): Promise<Clock> {
  return getSetting<Clock>(db, "clock", { mode: "live" });
}

export function nowFrom(clock: Clock, realNow = Date.now()): number {
  if (clock.mode === "live") return realNow;
  if (clock.paused) return clock.anchorSim;
  return clock.anchorSim + (realNow - clock.anchorReal) * clock.speed;
}

export async function now(db: Db): Promise<Date> {
  return new Date(nowFrom(await getClock(db)));
}

/** Change speed (or pause) without the simulated time jumping. */
export async function setReplay(db: Db, opts: { speed?: number; paused?: boolean; at?: number }) {
  const cur = await getClock(db);
  const realNow = Date.now();
  const simNow = opts.at ?? nowFrom(cur, realNow);
  const prev = cur.mode === "replay" ? cur : { speed: 60, paused: false };
  const next: Clock = {
    mode: "replay",
    anchorReal: realNow,
    anchorSim: simNow,
    speed: opts.speed ?? prev.speed,
    paused: opts.paused ?? prev.paused ?? false,
  };
  await setSetting(db, "clock", next);
  return next;
}
