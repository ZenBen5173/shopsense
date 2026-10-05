/**
 * Ring Partner API client (https://developer.amazon.com/docs/ring/api-documentation.html).
 *
 * Works with:
 *  - a Playground token (~30 min, no refresh — the owner pastes a new one),
 *  - an OAuth account link (4 h access token, rotating 30-day refresh token),
 *  - ring-sandbox, the community emulator, by pointing RING_API_BASE at it.
 */

import { RingAuthError, type RingClient, type RingDevice, type RingEvent, type Snapshot } from "./types";

export const RING_API_BASE = process.env.RING_API_BASE || "https://api.amazonvision.com";
export const RING_AUTHORIZE_URL = "https://account.ring.com/account/integrations/partner-link/authorize";
export const RING_TOKEN_URL = process.env.RING_TOKEN_URL || "https://oauth.ring.com/oauth/token";
/** The only scope the Partner API accepts today. */
export const RING_SCOPE = "ava.v1:read";

export interface RingAuth {
  mode: "playground" | "oauth";
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt?: number;
}

interface JsonApiList<T> {
  data: T[];
  links?: { next?: string | null };
}

interface DeviceResource {
  id: string;
  type: string;
  attributes?: { name?: string };
}

interface HistoryEventResource {
  id: string;
  type: string;
  attributes: { event_type: string; sub_type?: string; start: number | string; end?: number | string | null };
  relationships?: { source?: { data?: { id: string } } };
}

export const toMs = (v: number | string | null | undefined): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v; // tolerate seconds
  const n = Number(v);
  return Number.isFinite(n) ? toMs(n) : Date.parse(v);
};

export async function refreshRingToken(refreshToken: string): Promise<RingAuth> {
  // Ring rotates refresh tokens; fall back to the old one if a reply ever omits it.
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.RING_CLIENT_ID ?? "",
    client_secret: process.env.RING_CLIENT_SECRET ?? "",
  });
  const res = await fetch(RING_TOKEN_URL, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
  if (!res.ok) throw new RingAuthError(`Refresh failed (${res.status})`);
  const t = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { mode: "oauth", accessToken: t.access_token, refreshToken: t.refresh_token ?? refreshToken, expiresAt: Date.now() + t.expires_in * 1000 };
}

export async function exchangeRingCode(code: string, verifier: string, redirectUri: string): Promise<RingAuth> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    client_id: process.env.RING_CLIENT_ID ?? "",
    client_secret: process.env.RING_CLIENT_SECRET ?? "",
  });
  const res = await fetch(RING_TOKEN_URL, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
  if (!res.ok) throw new RingAuthError(`Code exchange failed (${res.status}): ${await res.text()}`);
  const t = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return { mode: "oauth", accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 };
}

export class PartnerRingClient implements RingClient {
  readonly kind = "ring" as const;

  constructor(
    private auth: RingAuth,
    /** Called when the token rotates, so the caller can persist it. */
    private onAuth: (a: RingAuth) => Promise<void> = async () => {},
    private base = RING_API_BASE,
    /** Re-reads the stored token: another instance may already have refreshed it. */
    private reload: () => Promise<RingAuth | null> = async () => null,
  ) {}

  /**
   * Refresh tokens are single-use. Before spending ours, check whether another
   * server instance already rotated it; if so, adopt theirs.
   */
  private async refresh() {
    const stored = await this.reload();
    if (stored && stored.accessToken !== this.auth.accessToken) {
      this.auth = stored;
      if (!stored.expiresAt || stored.expiresAt - Date.now() > 120_000) return;
    }
    if (!this.auth.refreshToken) throw new RingAuthError();
    this.auth = await refreshRingToken(this.auth.refreshToken);
    await this.onAuth(this.auth);
  }

  private async ensureFresh() {
    if (this.auth.mode === "oauth" && this.auth.refreshToken && this.auth.expiresAt && this.auth.expiresAt - Date.now() < 120_000) {
      await this.refresh();
    }
  }

  private async request(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
    await this.ensureFresh();
    const url = path.startsWith("http") ? path : `${this.base}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: { accept: "application/vnd.api+json, application/json", authorization: `Bearer ${this.auth.accessToken}`, ...(init.headers ?? {}) },
    });
    if (res.status === 401) {
      if (!retried && this.auth.mode === "oauth" && this.auth.refreshToken) {
        await this.refresh();
        return this.request(path, init, true);
      }
      throw new RingAuthError(this.auth.mode === "playground" ? "Playground token expired — paste a new one in Setup" : undefined);
    }
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000));
      if (!retried) return this.request(path, init, true);
    }
    return res;
  }

  async listDevices(): Promise<RingDevice[]> {
    const res = await this.request("/v1/devices");
    if (!res.ok) throw new Error(`GET /v1/devices failed (${res.status})`);
    const body = (await res.json()) as JsonApiList<DeviceResource>;
    return (body.data ?? []).map((d) => ({ id: d.id, name: d.attributes?.name ?? d.id }));
  }

  async listEvents(deviceId: string, sinceMs: number): Promise<RingEvent[]> {
    const out: RingEvent[] = [];
    let path: string | null = `/v1/history/devices/${encodeURIComponent(deviceId)}/events`;
    for (let page = 0; path && page < 10; page++) {
      const res: Response = await this.request(path);
      if (!res.ok) throw new Error(`GET history failed (${res.status})`);
      const body = (await res.json()) as JsonApiList<HistoryEventResource>;
      const data = body.data ?? [];
      let reachedOld = false;
      for (const e of data) {
        const start = toMs(e.attributes.start) ?? 0;
        if (start <= sinceMs) {
          reachedOld = true;
          continue;
        }
        out.push({
          id: e.id,
          deviceId: e.relationships?.source?.data?.id ?? deviceId,
          eventType: e.attributes.event_type,
          subType: e.attributes.sub_type ?? null,
          start: Math.round(start),
          end: toMs(e.attributes.end ?? null),
          raw: e,
        });
      }
      // ring-sandbox returns no `links` on an empty page; the docs always do.
      const next: string | null | undefined = body.links?.next;
      path = reachedOld || data.length === 0 || !next ? null : next;
    }
    return out.sort((a, b) => a.start - b.start);
  }

  async getSnapshot(event: RingEvent): Promise<Snapshot | null> {
    // The API answers with a 303 to a short-lived download URL; fetch follows it.
    const res = await this.request(`/v1/devices/${encodeURIComponent(event.deviceId)}/media/image/download`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "at_timestamp",
        timestamp: event.start + 1500, // a beat after motion starts, when the subject is in frame
        image_options: { format: "jpeg", resolution: { width: 1280, height: 720 } },
      }),
    });
    if (!res.ok) return null;
    return { mime: "image/jpeg", bytes: new Uint8Array(await res.arrayBuffer()) };
  }
}
