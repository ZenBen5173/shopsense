import { readyDb } from "@/lib/server/ready";
import { clearDemoData, setCameraCursor, setSetting, takeOauthState, upsertCamera } from "@/lib/db/repo";
import { exchangeRingCode, PartnerRingClient, RING_API_BASE } from "@/lib/ring/partner";
import { getRingAuth, saveRingAuth } from "@/lib/ring";

export const dynamic = "force-dynamic";

/** Finish the account link, register devices, and tell Ring the integration is complete. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (msg: string) => Response.redirect(`${url.origin}/setup?ring=${encodeURIComponent(msg)}`, 302);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return back(`denied:${url.searchParams.get("error")}`);
  if (!code || !state) return back("error:missing code");
  try {
    const db = await readyDb();
    const verifier = await takeOauthState(db, state);
    if (!verifier) return back("error:link expired, try again");
    const redirectUri = process.env.RING_REDIRECT_URI || `${url.origin}/api/ring/oauth/callback`;
    const auth = await exchangeRingCode(code, verifier, redirectUri);
    await clearDemoData(db);
    await saveRingAuth(db, auth);

    // Required by Ring once linking succeeds.
    await fetch(`${RING_API_BASE}/v1/accounts/me/app-integrations`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${auth.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    }).catch(() => undefined);

    const client = new PartnerRingClient(auth, (a) => saveRingAuth(db, a), undefined, () => getRingAuth(db));
    const now = Date.now();
    for (const d of await client.listDevices()) {
      await upsertCamera(db, { id: d.id, name: d.name, role: "ignore", source: "ring" });
      await setCameraCursor(db, d.id, now - 2 * 3600_000);
    }
    await setSetting(db, "source", "ring");
    await setSetting(db, "clock", { mode: "live" });
    return back("linked");
  } catch (err) {
    return back(`error:${(err as Error).message.slice(0, 120)}`);
  }
}
