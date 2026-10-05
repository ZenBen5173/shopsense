import { z } from "zod";
import { readyDb, jsonError } from "@/lib/server/ready";
import { addExpected, deleteExpected, listExpected } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    supplierName: z.string().trim().min(2).max(80),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
    windowStart: z.number().int().min(0).max(1439),
    windowEnd: z.number().int().min(1).max(1440),
  })
  .refine((b) => b.windowEnd > b.windowStart, { message: "The window must end after it starts" });

export async function GET() {
  try {
    return Response.json(await listExpected(await readyDb()));
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const db = await readyDb();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid supplier" }, { status: 400 });
    const { supplierName, weekdays, windowStart, windowEnd } = parsed.data;
    for (const weekday of weekdays) await addExpected(db, { supplierName, weekday, windowStart, windowEnd });
    return Response.json(await listExpected(db));
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const db = await readyDb();
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "id required" }, { status: 400 });
    await deleteExpected(db, id);
    return Response.json(await listExpected(db));
  } catch (err) {
    return jsonError(err);
  }
}
