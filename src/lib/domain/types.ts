/**
 * Shared domain types. Everything the brains compute works off these shapes,
 * whether the events came from a real Ring account or the built-in simulator.
 */

export type CameraRole = "front" | "back" | "ignore";
export type Confidence = "high" | "medium" | "low";
export type Lang = "en" | "ms";

export interface Camera {
  id: string;
  name: string;
  role: CameraRole;
  source: "sim" | "ring";
}

/** What the vision step says about one front-door snapshot. */
export interface FrontVision {
  kind: "front";
  /** People walking in (towards the camera / into the shop). */
  entering: number;
  /** People walking out. Counted so they are NOT double-counted as visitors. */
  leaving: number;
  /** Of the people entering, how many look like staff (uniform / apron). */
  staff: number;
  /** entering - staff, never negative. */
  customers: number;
  confidence: Confidence;
  notes?: string;
}

/** What the vision step says about one back-door snapshot. */
export interface BackVision {
  kind: "back";
  isDelivery: boolean;
  vehicle: string | null;
  /** Company name or logo text read off the vehicle or boxes, if any. */
  supplierText: string | null;
  description: string;
  confidence: Confidence;
}

export type VisionResult = FrontVision | BackVision;

export interface StoredEvent {
  id: string;
  cameraId: string;
  role: CameraRole;
  /** ISO 8601 UTC. */
  occurredAt: string;
  vision: VisionResult | null;
  provider: string | null;
}

export interface SalesDay {
  /** YYYY-MM-DD in shop time. */
  date: string;
  salesTotal: number;
  buyerCount: number;
}

export interface ExpectedDelivery {
  id: number;
  supplierName: string;
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number;
  /** Minutes after local midnight. */
  windowStart: number;
  windowEnd: number;
}

export type DeliveryStatus = "on_time" | "late" | "missing" | "pending" | "unexpected";

/** One delivery visit: a run of back-door delivery events close together. */
export interface DeliveryVisit {
  eventIds: string[];
  arrivedAt: string;
  leftAt: string;
  durationMin: number;
  supplierDetected: string | null;
  vehicle: string | null;
}

export interface DeliveryRecord {
  date: string;
  expected: ExpectedDelivery | null;
  visit: DeliveryVisit | null;
  status: DeliveryStatus;
  /** Minutes after the window end, when late. */
  lateByMin: number | null;
}

export interface ShopProfile {
  name: string;
  timezone: string;
  /** Minutes after midnight. */
  openAt: number;
  closeAt: number;
  /** What staff wear, given to the vision model instead of faces. */
  staffHint: string;
  currency: string;
  lang: Lang;
}
