import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { jsonError } from "@/lib/server/ready";
import { seedDemo } from "@/lib/sim/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startAt: z.number().int().min(0).max(1439).optional(),
  speed: z.number().min(1).max(3600).optional(),
});

/** Reload the demo shop, optionally replaying a chosen date (e.g. a Saturday). */
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: "Bad reset request" }, { status: 400 });
    const db = await getDb();
    return Response.json(await seedDemo(db, parsed.data));
  } catch (err) {
    return jsonError(err);
  }
}
