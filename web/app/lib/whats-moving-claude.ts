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
  liveOnly,
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

// Cached for 10 minutes per watchlist and shared by every TV showing it, so
// Bedrock sees about six calls an hour per distinct list (just six for the
// default board) no matter how many screens are on. Any failure — missing
// credentials, no model access, an error, a refusal, unparseable output —
// falls back to the plain price summary so the panel never breaks.
export async function getWhatsMoving(symbols: string[] | null = null): Promise<WhatsMoving> {
  "use cache";

  // Only summarize real quotes: right after a deploy a provider can be rate
  // limited, and its symbols then carry placeholder prices. Until every quote
  // is live, keep the summary only briefly so it corrects itself within a
  // minute. (expire stays at 10 minutes so the route remains prerendered.)
  const { items, live } = await getMarketData(symbols);
  const liveItems = liveOnly(items, live);
  if (liveItems.length === items.length) {
    cacheLife({ stale: 300, revalidate: 600, expire: 3_600 });
  } else {
    cacheLife({ stale: 30, revalidate: 30, expire: 600 });
  }
  const fallback = summarizeFromPrices(liveItems);

  try {
    const headlines = await getHeadlines();
    const response = await client.messages.parse({
      model: process.env.BEDROCK_MODEL ?? DEFAULT_MODEL,
      max_tokens: 4096,
      system: WHATS_MOVING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildWhatsMovingPrompt(liveItems, headlines) }],
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
