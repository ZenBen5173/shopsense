/**
 * Picks the vision provider for one event:
 *  1. Bedrock, when AWS credentials exist (real or simulated snapshots).
 *  2. Simulated perception, for simulator events without AWS.
 *  3. Ring's own motion sub-type, as a low-confidence last resort.
 */

import type { CameraRole, VisionResult } from "../domain/types";
import type { Snapshot } from "../ring/types";
import type { BackTruth, FrontTruth } from "../sim/scenario";
import { bedrockConfigured, VISION_MODEL } from "../ai/bedrock";
import { bedrockBack, bedrockFront } from "./bedrock";
import { perceive } from "./sim";

async function toRaster(s: Snapshot): Promise<{ format: "png" | "jpeg"; bytes: Uint8Array }> {
  if (s.mime === "image/jpeg") return { format: "jpeg", bytes: s.bytes };
  if (s.mime === "image/png") return { format: "png", bytes: s.bytes };
  const { Resvg } = await import("@resvg/resvg-js");
  const png = new Resvg(Buffer.from(s.bytes), { fitTo: { mode: "width", value: 960 } }).render().asPng();
  return { format: "png", bytes: new Uint8Array(png) };
}

export interface VisionInput {
  eventId: string;
  role: CameraRole;
  subType: string | null;
  raw: unknown;
  snapshot: () => Promise<Snapshot | null>;
  staffHint: string;
  /** How old the event is; fresh Ring events may not have a snapshot yet. */
  ageMs?: number;
}

/** Give Ring this long to make a snapshot available before settling for less. */
const SNAPSHOT_PATIENCE_MS = 10 * 60_000;

export interface VisionOutput {
  vision: VisionResult;
  provider: string;
}

function simTruth(raw: unknown): FrontTruth | BackTruth | null {
  if (raw && typeof raw === "object" && "sim" in raw && "truth" in raw) return (raw as { truth: FrontTruth | BackTruth }).truth;
  return null;
}

function fromRingSubType(role: CameraRole, subType: string | null): VisionResult {
  if (role === "front") {
    const n = subType === "human" ? 1 : 0;
    return { kind: "front", entering: n, leaving: 0, staff: 0, customers: n, confidence: "low", notes: "Counted from Ring motion type only" };
  }
  const isDelivery = subType === "vehicle";
  return { kind: "back", isDelivery, vehicle: isDelivery ? "vehicle" : null, supplierText: null, description: "Classified from Ring motion type only", confidence: "low" };
}

export function visionMode(): "bedrock" | "offline" {
  if (process.env.VISION_PROVIDER === "sim") return "offline";
  return bedrockConfigured() ? "bedrock" : "offline";
}

/**
 * Returns null when the event should be retried later: a real Ring event whose
 * snapshot isn't available yet (or whose Bedrock call failed) while it is
 * still young, instead of settling for a low-confidence guess forever.
 */
export async function analyse(input: VisionInput): Promise<VisionOutput | null> {
  const truth = simTruth(input.raw);
  const young = !truth && (input.ageMs ?? Infinity) < SNAPSHOT_PATIENCE_MS;
  if (visionMode() === "bedrock") {
    try {
      const snap = await input.snapshot();
      if (snap) {
        const img = await toRaster(snap);
        const vision = input.role === "front" ? await bedrockFront(img, input.staffHint) : await bedrockBack(img);
        return { vision, provider: `bedrock:${VISION_MODEL}` };
      }
      if (young) return null;
    } catch (err) {
      console.warn(`[vision] Bedrock failed for ${input.eventId}:`, (err as Error).message);
      if (young) return null;
    }
  }
  if (truth) return { vision: perceive(input.eventId, truth), provider: "sim-perception" };
  return { vision: fromRingSubType(input.role, input.subType), provider: "ring-motion-type" };
}
