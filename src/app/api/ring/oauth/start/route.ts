import { createHash, randomBytes } from "node:crypto";
import { readyDb, jsonError } from "@/lib/server/ready";
import { putOauthState } from "@/lib/db/repo";
import { RING_AUTHORIZE_URL, RING_SCOPE } from "@/lib/ring/partner";

export const dynamic = "force-dynamic";

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Begin the Ring account link: OAuth 2.0 authorization code with PKCE (required by Ring). */
export async function GET(req: Request) {
  try {
    const clientId = process.env.RING_CLIENT_ID;
    if (!clientId) return Response.json({ error: "RING_CLIENT_ID is not set. Use a Playground token instead." }, { status: 400 });
    const db = await readyDb();
    const verifier = b64url(randomBytes(48));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    const state = b64url(randomBytes(18));
    await putOauthState(db, state, verifier);
    const redirectUri = process.env.RING_REDIRECT_URI || `${new URL(req.url).origin}/api/ring/oauth/callback`;
    const url = new URL(RING_AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: RING_SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    return Response.redirect(url.toString(), 302);
  } catch (err) {
    return jsonError(err);
  }
}
