import "server-only";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { cacheLife } from "next/cache";
import { z } from "zod";
import { getHeadlines } from "./news";
import { getMarketData } from "./market-data";
import {
  WHATS_MOVING_SYSTEM_PROMPT,
  buildWhatsMovingPrompt,
  summarizeFromPrices,
  type WhatsMoving,
} from "./whats-moving";

/** Claude model on Amazon Bedrock; override with BEDROCK_MODEL. */
const DEFAULT_MODEL = "anthropic.claude-opus-5-5";

const SummarySchema = z.object({
  headline: z.string(),
  points: z.array(z.string()),
});

// Credentials come from the standard AWS chain: AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY env vars (e.g. on Vercel) or ~/.aws from
// `aws configure` (local dev).
const client = new AnthropicBedrockMantle({
  awsRegion: process.env.AWS_REGION ?? "eu-north-1",
});

// Cached for 10 minutes and shared by every TV, so Bedrock sees about six
// calls an hour no matter how many screens are on. Any failure — missing
// credentials, no model access, an error, a refusal, unparseable output —
// falls back to the plain price summary so the panel never breaks.
export async function getWhatsMoving(): Promise<WhatsMoving> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3_600 });

  const { items } = await getMarketData();
  const fallback = summarizeFromPrices(items);

  try {
    const headlines = await getHeadlines();
    const response = await client.messages.parse({
      model: process.env.BEDROCK_MODEL ?? DEFAULT_MODEL,
      max_tokens: 4096,
      system: WHATS_MOVING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildWhatsMovingPrompt(items, headlines) }],
      output_config: { effort: "low", format: zodOutputFormat(SummarySchema) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn(`[whats-moving] no usable output (stop_reason=${response.stop_reason})`);
      return fallback;
    }
    const { headline, points } = response.parsed_output;
    return { headline, points: points.slice(0, 3), source: "claude" };
  } catch (error) {
    console.warn(`[whats-moving] Bedrock call failed, using price summary: ${error}`);
    return fallback;
  }
}
