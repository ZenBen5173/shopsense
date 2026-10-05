import { z } from "zod";
import { readyDb, jsonError } from "@/lib/server/ready";
import { getShop, setSetting } from "@/lib/db/repo";
import { getRingAuth, getSource } from "@/lib/ring";
import { bedrockConfigured, TEXT_MODEL, VISION_MODEL } from "@/lib/ai/bedrock";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readyDb();
    const auth = await getRingAuth(db);
    return Response.json({
      shop: await getShop(db),
      source: await getSource(db),
      ring: auth ? { mode: auth.mode, expiresAt: auth.expiresAt ?? null } : null,
      oauthConfigured: Boolean(process.env.RING_CLIENT_ID && process.env.RING_CLIENT_SECRET),
      bedrock: { configured: bedrockConfigured(), visionModel: VISION_MODEL, textModel: TEXT_MODEL },
    });
  } catch (err) {
    return jsonError(err);
  }
}

const Body = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().min(3).max(60).optional(),
  openAt: z.number().int().min(0).max(1439).optional(),
  closeAt: z.number().int().min(1).max(1440).optional(),
  staffHint: z.string().max(120).optional(),
  currency: z.string().max(6).optional(),
  lang: z.enum(["en", "ms", "zh"]).optional(),
});

export async function PATCH(req: Request) {
  try {
    const db = await readyDb();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid shop settings" }, { status: 400 });
    if (parsed.data.timezone) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone });
      } catch {
        return Response.json({ error: "Unknown timezone" }, { status: 400 });
      }
    }
    const next = { ...(await getShop(db)), ...parsed.data };
    if (next.closeAt <= next.openAt) return Response.json({ error: "Closing time must be after opening time" }, { status: 400 });
    await setSetting(db, "shop", next);
    return Response.json(next);
  } catch (err) {
    return jsonError(err);
  }
}
