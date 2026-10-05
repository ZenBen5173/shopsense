import { z } from "zod";
import { readyDb, jsonError } from "@/lib/server/ready";
import { listCameras, setCameraRole } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listCameras(await readyDb()));
  } catch (err) {
    return jsonError(err);
  }
}

const Body = z.object({ id: z.string().min(1), role: z.enum(["front", "back", "ignore"]) });

/** Tag a camera as front door, back door, or unused. The tag decides which brain reads it. */
export async function PATCH(req: Request) {
  try {
    const db = await readyDb();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid camera role" }, { status: 400 });
    await setCameraRole(db, parsed.data.id, parsed.data.role);
    return Response.json(await listCameras(db));
  } catch (err) {
    return jsonError(err);
  }
}
