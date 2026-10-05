import { z } from "zod";
import { readyDb, jsonError } from "@/lib/server/ready";
import { getShop, listSales, upsertSales } from "@/lib/db/repo";
import { now } from "@/lib/clock";
import { addDays, localParts } from "@/lib/domain/time";

export const dynamic = "force-dynamic";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  salesTotal: z.coerce.number().min(0).max(10_000_000),
  /** Optional: owners often know takings but not receipts. */
  buyerCount: z.coerce.number().int().min(0).max(100_000).optional(),
});

/** The number the owner types at closing (plus how many receipts). */
export async function POST(req: Request) {
  try {
    const db = await readyDb();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter today's sales and the number of receipts." }, { status: 400 });
    const shop = await getShop(db);
    const date = parsed.data.date ?? localParts(await now(db), shop.timezone).date;
    let buyerCount = parsed.data.buyerCount;
    let estimated = false;
    if (buyerCount === undefined) {
      // Estimate receipts from the shop's usual basket over the last four weeks.
      const past = (await listSales(db, addDays(date, -28), addDays(date, -1))).filter((s) => s.buyerCount > 0);
      const rm = past.reduce((a, s) => a + s.salesTotal, 0);
      const buyers = past.reduce((a, s) => a + s.buyerCount, 0);
      if (buyers === 0) return Response.json({ error: "Add the number of receipts once, so ShopSense can learn your usual basket." }, { status: 400 });
      buyerCount = Math.round(parsed.data.salesTotal / (rm / buyers));
      estimated = true;
    }
    await upsertSales(db, { date, salesTotal: parsed.data.salesTotal, buyerCount }, estimated ? "estimated" : "owner");
    return Response.json({ ok: true, date, buyerCount, estimated });
  } catch (err) {
    return jsonError(err);
  }
}
