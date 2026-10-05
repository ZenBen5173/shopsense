import { readyDb, jsonError } from "@/lib/server/ready";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

/** The latest processed events with their raw vision verdicts — for the "How it works" page. */
export async function GET(req: Request) {
  try {
    const db = await readyDb();
    const asked = Number(new URL(req.url).searchParams.get("limit") ?? 12);
    const limit = Number.isFinite(asked) ? Math.min(30, Math.max(1, Math.floor(asked))) : 12;
    // The latest events, plus the latest few deliveries so a van with a logo is always on show.
    const rows = await db.query<{ id: string; name: string; role: string; occurred_at: Date; vision_result: unknown; vision_provider: string | null; sub_type: string | null }>(
      `SELECT * FROM (
         (SELECT e.id, c.name, c.role, e.occurred_at, e.vision_result, e.vision_provider, e.sub_type
            FROM events e JOIN cameras c ON c.id = e.camera_id
           WHERE e.vision_result IS NOT NULL AND e.occurred_at <= $1 AND c.role <> 'ignore'
           ORDER BY e.occurred_at DESC LIMIT $2)
         UNION
         (SELECT e.id, c.name, c.role, e.occurred_at, e.vision_result, e.vision_provider, e.sub_type
            FROM events e JOIN cameras c ON c.id = e.camera_id
           WHERE e.vision_result IS NOT NULL AND e.occurred_at <= $1 AND c.role = 'back'
             AND e.vision_result->>'isDelivery' = 'true'
           ORDER BY e.occurred_at DESC LIMIT 3)
       ) x ORDER BY occurred_at DESC`,
      [(await now(db)).toISOString(), limit],
    );
    return Response.json(rows.map((r) => ({ id: r.id, camera: r.name, role: r.role, at: new Date(r.occurred_at).toISOString(), subType: r.sub_type, vision: r.vision_result, provider: r.vision_provider })));
  } catch (err) {
    return jsonError(err);
  }
}
