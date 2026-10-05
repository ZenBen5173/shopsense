import { readyDb, jsonError } from "@/lib/server/ready";
import { getEventRaw, getSnapshot } from "@/lib/db/repo";
import { renderSnapshotSvg } from "@/lib/sim/snapshot";
import type { BackTruth, FrontTruth } from "@/lib/sim/scenario";

export const dynamic = "force-dynamic";

/**
 * Snapshot for one event. Simulated events are redrawn from their ground
 * truth; real ones exist only for back-door deliveries (front-door images are
 * never stored).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const db = await readyDb();
    const stored = await getSnapshot(db, id);
    if (stored) {
      return new Response(Buffer.from(stored.data), { headers: { "content-type": stored.mime, "cache-control": "private, max-age=86400" } });
    }
    const ev = await getEventRaw(db, id);
    const raw = ev?.raw as { sim?: boolean; truth?: FrontTruth | BackTruth } | null;
    if (ev && raw?.sim && raw.truth) {
      const svg = renderSnapshotSvg({ id, deviceId: ev.cameraId, start: Date.parse(ev.occurredAt), end: 0, eventType: "motion", subType: "human", truth: raw.truth });
      return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400, immutable" } });
    }
    return new Response("Not stored", { status: 404 });
  } catch (err) {
    return jsonError(err);
  }
}
