import type { Db } from "../db/client";
import { getSetting, setSetting } from "../db/repo";
import { PartnerRingClient, type RingAuth } from "./partner";
import { SimRingClient } from "./sim";
import type { RingClient } from "./types";

export type Source = "sim" | "ring";

export async function getSource(db: Db): Promise<Source> {
  return getSetting<Source>(db, "source", "sim");
}

export async function getRingAuth(db: Db): Promise<RingAuth | null> {
  return getSetting<RingAuth | null>(db, "ring_auth", null);
}

export async function saveRingAuth(db: Db, auth: RingAuth) {
  await setSetting(db, "ring_auth", auth);
}

/** The Ring client for the current source; null when Ring is chosen but not linked. */
export async function getRingClient(db: Db, nowMs: number): Promise<RingClient | null> {
  if ((await getSource(db)) === "sim") return new SimRingClient(nowMs);
  const auth = await getRingAuth(db);
  if (!auth) return null;
  return new PartnerRingClient(auth, (a) => saveRingAuth(db, a), undefined, () => getRingAuth(db));
}
