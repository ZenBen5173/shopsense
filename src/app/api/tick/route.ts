import { readyDb, jsonError } from "@/lib/server/ready";
import { tick } from "@/lib/poller";

export const dynamic = "force-dynamic";

/** One poll of Ring + vision. The open dashboard calls this every few seconds. */
export async function POST() {
  try {
    const db = await readyDb();
    return Response.json(await tick(db));
  } catch (err) {
    return jsonError(err);
  }
}
