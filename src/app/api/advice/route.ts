import { readyDb, jsonError } from "@/lib/server/ready";
import { computeDashboard } from "@/lib/dashboard";
import { getAdviceFor } from "@/lib/advice";
import type { Lang } from "@/lib/domain/types";
import { isLang } from "@/lib/domain/lang";

export const dynamic = "force-dynamic";

/** Ask Bedrock for fresh advice (falls back to the template writer). */
export async function POST(req: Request) {
  try {
    const db = await readyDb();
    const body = (await req.json().catch(() => ({}))) as { lang?: string };
    const lang: Lang | undefined = isLang(body.lang) ? body.lang : undefined;
    const data = await computeDashboard(db, lang);
    return Response.json(await getAdviceFor(db, data, data.lang, true));
  } catch (err) {
    return jsonError(err);
  }
}
