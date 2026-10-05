/**
 * Amazon Bedrock, via the model-agnostic Converse API, so the vision and text
 * models can be swapped by env var (Claude, Amazon Nova, ...) with no code change.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";

export const BEDROCK_REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1";
export const VISION_MODEL = process.env.BEDROCK_VISION_MODEL || "global.anthropic.claude-opus-5-5";
export const TEXT_MODEL = process.env.BEDROCK_TEXT_MODEL || "global.anthropic.claude-opus-5-5";

/** True when some AWS credential source is configured (keys, profile, SSO, Bedrock API key). */
export function bedrockConfigured(): boolean {
  if (process.env.BEDROCK_DISABLED === "1") return false;
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_PROFILE ||
      process.env.AWS_BEARER_TOKEN_BEDROCK ||
      process.env.AWS_WEB_IDENTITY_TOKEN_FILE ||
      process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI,
  );
}

let client: BedrockRuntimeClient | null = null;
function bedrock() {
  client ??= new BedrockRuntimeClient({ region: BEDROCK_REGION });
  return client;
}

export interface ConverseInput {
  modelId: string;
  system: string;
  text: string;
  image?: { format: "png" | "jpeg"; bytes: Uint8Array };
  maxTokens?: number;
}

/** One Converse call; returns the model's text. */
export async function converse({ modelId, system, text, image, maxTokens = 2000 }: ConverseInput): Promise<string> {
  const content: ContentBlock[] = [];
  if (image) content.push({ image: { format: image.format, source: { bytes: image.bytes } } });
  content.push({ text });
  const messages: Message[] = [{ role: "user", content }];
  // No temperature: current Claude models reject sampling parameters.
  const res = await bedrock().send(
    new ConverseCommand({ modelId, system: [{ text: system }], messages, inferenceConfig: { maxTokens } }),
  );
  const blocks = res.output?.message?.content ?? [];
  const out = blocks.map((b) => ("text" in b && b.text ? b.text : "")).join("").trim();
  if (!out) throw new Error(`Bedrock returned no text (stopReason ${res.stopReason})`);
  return out;
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model reply");
  return JSON.parse(body.slice(start, end + 1));
}
