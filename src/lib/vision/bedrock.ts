/**
 * The vision step on Bedrock: one snapshot in, a small validated JSON verdict out.
 * Prompts ask for counts and patterns only — never identities or faces.
 */

import { z } from "zod";
import { converse, extractJson, VISION_MODEL } from "../ai/bedrock";
import type { BackVision, FrontVision } from "../domain/types";

const conf = z.enum(["high", "medium", "low"]).catch("low");

const FrontSchema = z.object({
  entering: z.coerce.number().int().min(0).max(30),
  leaving: z.coerce.number().int().min(0).max(30),
  staff_entering: z.coerce.number().int().min(0).max(30).default(0),
  confidence: conf,
  notes: z.string().optional(),
});

const BackSchema = z.object({
  is_delivery: z.coerce.boolean(),
  vehicle: z.string().nullable().optional(),
  company_text: z.string().nullable().optional(),
  description: z.string().default(""),
  confidence: conf,
});

const SYSTEM =
  "You analyse still frames from a small shop's security camera to produce anonymous business statistics. " +
  "Never identify, name or describe any individual's face, age, race or other personal traits. " +
  "Count and classify only. Reply with one JSON object and nothing else.";

export async function bedrockFront(image: { format: "png" | "jpeg"; bytes: Uint8Array }, staffHint: string): Promise<FrontVision> {
  const text = [
    "This frame is from a camera above a shop's front door, looking out at the entrance.",
    "People facing the camera / moving towards it are walking IN. People with their back to the camera are walking OUT.",
    staffHint ? `Staff can be recognised by: ${staffHint}. Count them separately; they are not customers.` : "There is no staff uniform; assume nobody is staff.",
    'Return JSON: {"entering": int, "leaving": int, "staff_entering": int (of those entering, how many are staff), "confidence": "high"|"medium"|"low", "notes": short string}.',
    'Use "low" when people overlap, the image is dark or blurry, or direction is unclear.',
  ].join("\n");
  const raw = await converse({ modelId: VISION_MODEL, system: SYSTEM, text, image, maxTokens: 1500 });
  const v = FrontSchema.parse(extractJson(raw));
  const staff = Math.min(v.staff_entering, v.entering);
  return { kind: "front", entering: v.entering, leaving: v.leaving, staff, customers: v.entering - staff, confidence: v.confidence, notes: v.notes };
}

export async function bedrockBack(image: { format: "png" | "jpeg"; bytes: Uint8Array }): Promise<BackVision> {
  const text = [
    "This frame is from a camera watching a shop's back door and loading lane.",
    "Decide whether it shows a supplier delivery: a van, lorry or pickup stopped at the door, or a courier carrying goods or boxes.",
    "Motorbikes passing, animals, or staff taking out rubbish are NOT deliveries.",
    "If there is a company name or logo on the vehicle or boxes, copy its text exactly.",
    'Return JSON: {"is_delivery": bool, "vehicle": short string or null, "company_text": string or null, "description": one short sentence, "confidence": "high"|"medium"|"low"}.',
  ].join("\n");
  const raw = await converse({ modelId: VISION_MODEL, system: SYSTEM, text, image, maxTokens: 1500 });
  const v = BackSchema.parse(extractJson(raw));
  return {
    kind: "back",
    isDelivery: v.is_delivery,
    vehicle: v.vehicle ?? null,
    supplierText: v.company_text?.trim() || null,
    description: v.description,
    confidence: v.confidence,
  };
}
