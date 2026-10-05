import { afterEach, describe, expect, it, vi } from "vitest";
import { PartnerRingClient } from "./partner";
import { RingAuthError } from "./types";
import { extractJson } from "../ai/bedrock";

const BASE = "https://ring.test";

function fakeRing(routes: Record<string, (req: Request) => Response | Promise<Response>>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const key = `${req.method} ${url.pathname}${decodeURIComponent(url.search)}`;
    calls.push(key);
    const handler = routes[key] ?? routes[`${req.method} ${url.pathname}`];
    if (!handler) return new Response("not found", { status: 404 });
    return handler(req);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("Ring Partner API client", () => {
  it("lists devices from a JSON:API response with a bearer token", async () => {
    let auth = "";
    fakeRing({
      "GET /v1/devices": (req) => {
        auth = req.headers.get("authorization") ?? "";
        return Response.json({ data: [{ type: "devices", id: "ava1.ring.device.A", attributes: { name: "Front Door Camera" } }] });
      },
    });
    const c = new PartnerRingClient({ mode: "playground", accessToken: "tok" }, undefined, BASE);
    expect(await c.listDevices()).toEqual([{ id: "ava1.ring.device.A", name: "Front Door Camera" }]);
    expect(auth).toBe("Bearer tok");
  });

  it("pages event history until it passes the cursor, oldest first", async () => {
    const T = 1_791_000_000_000; // realistic epoch ms
    const ev = (id: string, start: number) => ({ type: "history-events", id, attributes: { event_type: "motion", start: T + start, end: T + start + 5000 }, relationships: { source: { data: { type: "devices", id: "D" } } } });
    const calls = fakeRing({
      "GET /v1/history/devices/D/events": () => Response.json({ data: [ev("e3", 3000), ev("e2", 2000)], links: { next: `${BASE}/v1/history/devices/D/events?page[key]=2` } }),
      "GET /v1/history/devices/D/events?page[key]=2": () => Response.json({ data: [ev("e1", 1000), ev("e0", 500)], links: { next: `${BASE}/v1/history/devices/D/events?page[key]=3` } }),
    });
    const c = new PartnerRingClient({ mode: "playground", accessToken: "tok" }, undefined, BASE);
    const events = await c.listEvents("D", T + 900);
    expect(events.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    expect(calls.length).toBe(2); // stopped once it saw an event older than the cursor
  });

  it("stops on an empty page with no links (ring-sandbox shape)", async () => {
    fakeRing({ "GET /v1/history/devices/D/events": () => Response.json({ data: [] }) });
    const c = new PartnerRingClient({ mode: "playground", accessToken: "tok" }, undefined, BASE);
    expect(await c.listEvents("D", 0)).toEqual([]);
  });

  it("raises a clear auth error when a Playground token expires", async () => {
    fakeRing({ "GET /v1/devices": () => new Response("expired", { status: 401 }) });
    const c = new PartnerRingClient({ mode: "playground", accessToken: "old" }, undefined, BASE);
    await expect(c.listDevices()).rejects.toBeInstanceOf(RingAuthError);
  });

  it("refreshes an OAuth token on 401, retries, and persists the rotated token", async () => {
    let n = 0;
    const saved: string[] = [];
    fakeRing({
      "GET /v1/devices": (req) => (req.headers.get("authorization") === "Bearer new" ? Response.json({ data: [] }) : new Response("", { status: 401 })),
      "POST /oauth/token": async (req) => {
        n++;
        const body = new URLSearchParams(await req.text());
        expect(body.get("grant_type")).toBe("refresh_token");
        expect(body.get("refresh_token")).toBe("r1");
        return Response.json({ access_token: "new", refresh_token: "r2", expires_in: 14400, token_type: "Bearer" });
      },
    });
    process.env.RING_TOKEN_URL = undefined;
    const c = new PartnerRingClient({ mode: "oauth", accessToken: "old", refreshToken: "r1", expiresAt: Date.now() + 3_600_000 }, async (a) => void saved.push(a.refreshToken!), BASE);
    // Token endpoint lives on oauth.ring.com; route it to the fake by path.
    expect(await c.listDevices()).toEqual([]);
    expect(n).toBe(1);
    expect(saved).toEqual(["r2"]);
  });

  it("asks for a snapshot at the moment of motion and returns the bytes", async () => {
    let body: Record<string, unknown> = {};
    fakeRing({
      "POST /v1/devices/D/media/image/download": async (req) => {
        body = await req.json();
        return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { "content-type": "image/jpeg" } });
      },
    });
    const c = new PartnerRingClient({ mode: "playground", accessToken: "tok" }, undefined, BASE);
    const snap = await c.getSnapshot({ id: "e", deviceId: "D", eventType: "motion", subType: "human", start: 10_000, end: null });
    expect(snap?.bytes.length).toBe(3);
    expect(body.type).toBe("at_timestamp");
    expect(body.timestamp).toBe(11_500);
  });
});

describe("Bedrock reply parsing", () => {
  it("pulls JSON out of fences and chatter", () => {
    expect(extractJson('Sure!\n```json\n{"entering": 2, "leaving": 0}\n```')).toEqual({ entering: 2, leaving: 0 });
    expect(extractJson('Result: {"is_delivery": true} done')).toEqual({ is_delivery: true });
    expect(() => extractJson("no json here")).toThrow();
  });
});
