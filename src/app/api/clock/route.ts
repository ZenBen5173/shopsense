import { z } from "zod";
import { readyDb, jsonError } from "@/lib/server/ready";
import { getClock, nowFrom, setReplay } from "@/lib/clock";
import { getShop, setSetting } from "@/lib/db/repo";
import { localParts, zonedToUtc } from "@/lib/domain/time";

export const dynamic = "force-dynamic";

const Body = z.object({
  speed: z.number().min(1).max(3600).optional(),
  paused: z.boolean().optional(),
  /** Jump to this minute of today (shop time). Forwards only: ingested events stay. */
  jumpTo: z.number().int().min(0).max(24 * 60 - 1).optional(),
  live: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const db = await readyDb();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Bad clock request" }, { status: 400 });
    const { speed, paused, jumpTo, live } = parsed.data;
    if (live) {
      await setSetting(db, "clock", { mode: "live" });
      return Response.json({ mode: "live" });
    }
    let at: number | undefined;
    if (jumpTo !== undefined) {
      const shop = await getShop(db);
      const cur = nowFrom(await getClock(db));
      const target = zonedToUtc(localParts(cur, shop.timezone).date, jumpTo, shop.timezone).getTime();
      at = Math.max(cur, target);
    }
    return Response.json(await setReplay(db, { speed, paused, at }));
  } catch (err) {
    return jsonError(err);
  }
}
