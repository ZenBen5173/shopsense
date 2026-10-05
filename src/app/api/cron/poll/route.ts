import { readyDb, jsonError } from "@/lib/server/ready";
import { tick } from "@/lib/poller";

export const dynamic = "force-dynamic";

/** Vercel Cron entry point, so events are ingested even with no dashboard open. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const db = await readyDb();
    const results = [];
    for (let i = 0; i < 5; i++) {
      const r = await tick(db);
      results.push(r);
      if (!r.remaining) break;
    }
    return Response.json({ results });
  } catch (err) {
    return jsonError(err);
  }
}
