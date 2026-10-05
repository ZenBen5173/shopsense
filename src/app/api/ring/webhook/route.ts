import { createHmac, timingSafeEqual } from "node:crypto";
import { readyDb } from "@/lib/server/ready";
import { hasEventNear, insertEvents, listCameras } from "@/lib/db/repo";
import { toMs } from "@/lib/ring/partner";

export const dynamic = "force-dynamic";

interface WebhookBody {
  meta?: { version?: string; time?: string; request_id?: string };
  data?: {
    id?: string;
    type?: string;
    attributes?: { source?: string; source_type?: string; timestamp?: number; sub_type?: string };
  };
}

/**
 * Ring webhook receiver: motion events arrive in real time instead of waiting
 * for the next poll. Verifies the HMAC-SHA256 X-Signature over the RAW body
 * before parsing, stores the event, and answers fast (Ring wants 200 < 5 s);
 * vision runs on the next poller tick.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 64_000) return Response.json({ error: "too large" }, { status: 413 });
  const secret = process.env.RING_WEBHOOK_SECRET;
  // Without a secret anyone could inject fake motion; only the demo accepts unsigned calls.
  if (!secret && process.env.NODE_ENV === "production") return Response.json({ error: "webhook secret not configured" }, { status: 503 });
  if (secret) {
    const sig = (req.headers.get("x-signature") ?? "").trim().toLowerCase();
    const want = createHmac("sha256", secret).update(raw).digest("hex");
    const ok = sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want));
    if (!ok) return Response.json({ error: "bad signature" }, { status: 401 });
  }
  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const d = body.data;
  if (d?.type !== "motion_detected" || !d.attributes?.source || !d.id) return Response.json({ ok: true, ignored: d?.type ?? "unknown" });

  const db = await readyDb();
  const cam = (await listCameras(db)).find((c) => c.id === d.attributes!.source);
  if (!cam || cam.role === "ignore") return Response.json({ ok: true, ignored: "camera not tagged" });
  const ts = Math.round(toMs(d.attributes.timestamp ?? null) ?? Date.now());
  // The same motion will also show up in Event History, possibly under another id.
  if (await hasEventNear(db, cam.id, ts)) return Response.json({ ok: true, duplicate: true });
  await insertEvents(db, [{
    id: d.id,
    cameraId: cam.id,
    occurredAt: new Date(ts).toISOString(),
    eventType: "motion",
    subType: d.attributes.sub_type ?? null,
    raw: body,
  }]);
  return Response.json({ ok: true });
}
