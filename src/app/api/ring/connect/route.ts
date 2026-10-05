import { z } from "zod";
import { readyDb, jsonError } from "@/lib/server/ready";
import { clearDemoData, listCameras, setCameraCursor, setSetting, upsertCamera } from "@/lib/db/repo";
import { seedDemo } from "@/lib/sim/seed";
import { getRingAuth } from "@/lib/ring";
import { PartnerRingClient } from "@/lib/ring/partner";
import { saveRingAuth } from "@/lib/ring";
import { RingAuthError } from "@/lib/ring/types";

export const dynamic = "force-dynamic";

const Body = z.union([
  z.object({ mode: z.literal("playground"), token: z.string().min(20).max(8000) }),
  z.object({ mode: z.literal("sim") }),
]);

/**
 * Switch the data source. "playground" takes a token from the Ring developer
 * console (valid ~30 minutes), checks it by listing devices, and registers
 * each device as a camera to be tagged. "sim" goes back to the demo shop.
 */
export async function POST(req: Request) {
  try {
    const db = await readyDb();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Paste a Playground token, or choose the demo shop." }, { status: 400 });

    if (parsed.data.mode === "sim") {
      // Reload the demo shop, but keep any Ring link so switching back is one click.
      const auth = await getRingAuth(db);
      await seedDemo(db);
      if (auth) await saveRingAuth(db, auth);
      return Response.json({ source: "sim" });
    }

    const auth = { mode: "playground" as const, accessToken: parsed.data.token.trim().replace(/^Bearer\s+/i, ""), expiresAt: Date.now() + 30 * 60_000 };
    const client = new PartnerRingClient(auth);
    let devices;
    try {
      devices = await client.listDevices();
    } catch (err) {
      const msg = err instanceof RingAuthError ? "Ring rejected that token. Generate a fresh one in the Playground." : (err as Error).message;
      return Response.json({ error: msg }, { status: 400 });
    }
    await clearDemoData(db); // never mix the demo shop's month of fake events with real ones
    await saveRingAuth(db, auth);
    await setSetting(db, "source", "ring");
    const now = Date.now();
    for (const d of devices) {
      await upsertCamera(db, { id: d.id, name: d.name, role: "ignore", source: "ring" });
      await setCameraCursor(db, d.id, now - 2 * 3600_000);
    }
    await setSetting(db, "clock", { mode: "live" });
    return Response.json({ source: "ring", devices, cameras: await listCameras(db) });
  } catch (err) {
    return jsonError(err);
  }
}
