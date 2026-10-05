/**
 * The slice of the Ring Partner API ShopSense needs, as an interface. Two
 * implementations: the real HTTP client (Playground token, OAuth, or a local
 * ring-sandbox emulator via RING_API_BASE) and the built-in shop simulator.
 */

export interface RingDevice {
  id: string;
  name: string;
}

export interface RingEvent {
  id: string;
  deviceId: string;
  /** e.g. "motion", "ding". */
  eventType: string;
  /** e.g. "human", "vehicle", or null when Ring doesn't say. */
  subType: string | null;
  /** Epoch ms. */
  start: number;
  end: number | null;
  /** Provider-specific extras (simulator ground truth, or the raw payload). */
  raw?: unknown;
}

export interface Snapshot {
  mime: "image/jpeg" | "image/png" | "image/svg+xml";
  bytes: Uint8Array;
}

export interface RingClient {
  readonly kind: "ring" | "sim";
  listDevices(): Promise<RingDevice[]>;
  /** Events that started after `sinceMs`, oldest first. */
  listEvents(deviceId: string, sinceMs: number): Promise<RingEvent[]>;
  getSnapshot(event: RingEvent): Promise<Snapshot | null>;
}

export class RingAuthError extends Error {
  constructor(message = "Ring token expired or was revoked") {
    super(message);
    this.name = "RingAuthError";
  }
}
