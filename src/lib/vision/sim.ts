/**
 * Simulated perception: what a good-but-imperfect vision model would report
 * for a simulated snapshot. It reads the ground truth and adds realistic,
 * deterministic mistakes (miscounted groups, unreadable logos), so the
 * dashboard's error bands are earned rather than decorative.
 *
 * Used when no AWS credentials are present. With credentials, the same
 * snapshot goes to Bedrock instead (see ./bedrock.ts).
 */

import type { BackTruth, FrontTruth } from "../sim/scenario";
import type { BackVision, FrontVision, VisionResult } from "../domain/types";
import { rng } from "../sim/random";

export function perceiveFront(eventId: string, t: FrontTruth): FrontVision {
  const r = rng(`vision:${eventId}`);
  const group = t.entering + t.leaving;
  let entering = t.entering;
  let leaving = t.leaving;
  // Groups of three overlap in frame and get miscounted now and then.
  if (group >= 3 && r.chance(0.18)) entering = Math.max(0, entering + (r.chance(0.5) ? -1 : 1));
  else if (t.entering > 0 && r.chance(0.025)) entering = Math.max(0, entering + (r.chance(0.5) ? -1 : 1));
  // Someone walking out but glancing back reads as walking in, now and then.
  if (t.leaving > 0 && t.entering === 0 && r.chance(0.01)) {
    entering = 1;
    leaving = Math.max(0, leaving - 1);
  }
  let staff = Math.min(entering, t.staff);
  if (staff > 0 && r.chance(0.05)) staff -= 1; // apron hidden by a bag
  const confidence = group >= 3 ? "medium" : r.chance(0.06) ? "low" : "high";
  return { kind: "front", entering, leaving, staff, customers: Math.max(0, entering - staff), confidence };
}

export function perceiveBack(eventId: string, t: BackTruth): BackVision {
  const r = rng(`vision:${eventId}`);
  if (!t.isDelivery) {
    const description =
      t.what === "cat" ? "A cat walking across the lane." :
      t.what === "motorbike" ? "A motorbike passing through the lane, not stopping." :
      "A staff member in an apron taking out rubbish.";
    return { kind: "back", isDelivery: false, vehicle: t.vehicle, supplierText: null, description, confidence: "high" };
  }
  const readable = t.phase !== "unload" ? r.chance(0.88) : r.chance(0.6);
  const supplierText = readable ? t.logo : null;
  const description =
    t.phase === "arrive" ? `A ${t.vehicle} pulls up at the back door.` :
    t.phase === "leave" ? `A ${t.vehicle} is driving off.` :
    "A delivery worker carrying boxes to the back door.";
  return {
    kind: "back",
    isDelivery: true,
    vehicle: t.phase === "unload" ? null : t.vehicle,
    supplierText,
    description,
    confidence: readable ? "high" : "medium",
  };
}

export function perceive(eventId: string, t: FrontTruth | BackTruth): VisionResult {
  return t.kind === "front" ? perceiveFront(eventId, t) : perceiveBack(eventId, t);
}
