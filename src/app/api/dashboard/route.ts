import { readyDb, jsonError } from "@/lib/server/ready";
import { computeDashboard } from "@/lib/dashboard";
import { getAdviceFor } from "@/lib/advice";
import type { Lang } from "@/lib/domain/types";
import { isLang } from "@/lib/domain/lang";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const db = await readyDb();
    const q = new URL(req.url).searchParams.get("lang");
    const lang: Lang | undefined = isLang(q) ? q : undefined;
    const data = await computeDashboard(db, lang);
    const advice = await getAdviceFor(db, data, data.lang, false);
    return Response.json({ ...data, advice });
  } catch (err) {
    return jsonError(err);
  }
}
