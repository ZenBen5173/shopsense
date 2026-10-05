import { beforeEach, describe, expect, it, vi } from "vitest";

const reply = { text: "" };
const seen: { system?: string; text?: string; format?: string }[] = [];

vi.mock("../ai/bedrock", async (orig) => {
  const real = await orig<typeof import("../ai/bedrock")>();
  return {
    ...real,
    bedrockConfigured: () => true,
    converse: vi.fn(async (input: { system: string; text: string; image?: { format: string } }) => {
      seen.push({ system: input.system, text: input.text, format: input.image?.format });
      if (reply.text === "THROW") throw new Error("throttled");
      return reply.text;
    }),
  };
});

const { analyse } = await import("./index");
const { generateDay } = await import("../sim/scenario");
const { renderSnapshotSvg } = await import("../sim/snapshot");

const day = generateDay("2026-10-03");
const frontEv = day.events.find((e) => e.truth.kind === "front" && e.truth.entering === 2)!;
const backEv = day.events.find((e) => e.truth.kind === "back" && e.truth.isDelivery && e.truth.phase === "arrive")!;
const svg = (e: typeof frontEv) => async () => ({ mime: "image/svg+xml" as const, bytes: new TextEncoder().encode(renderSnapshotSvg(e)) });

beforeEach(() => {
  seen.length = 0;
  delete process.env.VISION_PROVIDER;
});

describe("vision routing with Bedrock", () => {
  it("rasterises a simulated snapshot to PNG, sends the staff hint, and validates the reply", async () => {
    reply.text = '```json\n{"entering": 2, "leaving": 0, "staff_entering": 1, "confidence": "high", "notes": "two people"}\n```';
    const out = await analyse({ eventId: frontEv.id, role: "front", subType: "human", raw: { sim: true, truth: frontEv.truth }, snapshot: svg(frontEv), staffHint: "red apron" });
    expect(out!.provider.startsWith("bedrock:")).toBe(true);
    expect(out!.vision).toMatchObject({ kind: "front", entering: 2, staff: 1, customers: 1, confidence: "high" });
    expect(seen[0].format).toBe("png");
    expect(seen[0].text).toContain("red apron");
    expect(seen[0].system).toMatch(/Never identify/);
  });

  it("reads a supplier name off a delivery van", async () => {
    reply.text = '{"is_delivery": true, "vehicle": "green pickup", "company_text": "SEGAR FRESH", "description": "A green pickup at the back door.", "confidence": "high"}';
    const out = await analyse({ eventId: backEv.id, role: "back", subType: "vehicle", raw: { sim: true, truth: backEv.truth }, snapshot: svg(backEv), staffHint: "" });
    expect(out!.vision).toMatchObject({ kind: "back", isDelivery: true, supplierText: "SEGAR FRESH" });
  });

  it("falls back to offline perception when Bedrock errors or replies with nonsense", async () => {
    reply.text = "THROW";
    const a = await analyse({ eventId: backEv.id, role: "back", subType: "vehicle", raw: { sim: true, truth: backEv.truth }, snapshot: svg(backEv), staffHint: "" });
    expect(a!.provider).toBe("sim-perception");
    reply.text = '{"entering": "lots"}';
    const b = await analyse({ eventId: frontEv.id, role: "front", subType: "human", raw: { sim: true, truth: frontEv.truth }, snapshot: svg(frontEv), staffHint: "" });
    expect(b!.provider).toBe("sim-perception");
  });

  it("uses Ring's motion type, at low confidence, for a real event with no snapshot or AI", async () => {
    process.env.VISION_PROVIDER = "sim";
    const out = await analyse({ eventId: "real-1", role: "back", subType: "vehicle", raw: { type: "history-events" }, snapshot: async () => null, staffHint: "" });
    expect(out!.provider).toBe("ring-motion-type");
    expect(out!.vision).toMatchObject({ kind: "back", isDelivery: true, confidence: "low" });
  });

  it("waits (returns null) for a fresh real Ring event whose snapshot isn't ready yet", async () => {
    const young = await analyse({ eventId: "real-2", role: "front", subType: "human", raw: { type: "history-events" }, snapshot: async () => null, staffHint: "", ageMs: 30_000 });
    expect(young).toBeNull();
    const old = await analyse({ eventId: "real-2", role: "front", subType: "human", raw: { type: "history-events" }, snapshot: async () => null, staffHint: "", ageMs: 20 * 60_000 });
    expect(old!.provider).toBe("ring-motion-type");
  });
});
