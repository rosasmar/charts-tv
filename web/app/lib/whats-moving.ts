import type { Headline } from "./rss";
import { formatChange, formatPrice, type WatchlistItem } from "./watchlist";

export type WhatsMoving = {
  /** One short line, e.g. "SOL leads as DOGE slides". */
  headline: string;
  /** Up to three short supporting points. */
  points: string[];
  /** "claude" when written by Claude on Bedrock, "prices" for the fallback. */
  source: "claude" | "prices";
};

/** Moves smaller than this (in %) count as flat. */
const FLAT_PCT = 0.5;

// The plain summary shown when Claude isn't available (no credentials, an
// error, or a refusal). It only restates the numbers, so it can't be wrong.
export function summarizeFromPrices(items: WatchlistItem[]): WhatsMoving {
  const byMove = [...items].sort((a, b) => b.change24h - a.change24h);
  const top = byMove[0];
  const bottom = byMove[byMove.length - 1];
  if (!top || !bottom) {
    return { headline: "Waiting for prices", points: [], source: "prices" };
  }

  const headline =
    top.change24h >= FLAT_PCT && bottom.change24h <= -FLAT_PCT
      ? `${top.symbol} leads, ${bottom.symbol} lags`
      : top.change24h >= FLAT_PCT
        ? `${top.symbol} leads a green board`
        : bottom.change24h <= -FLAT_PCT
          ? `${bottom.symbol} leads the board lower`
          : "A quiet board";

  const points = [
    `${top.symbol} ${formatChange(top.change24h)} at ${formatPrice(top.price)}`,
    `${bottom.symbol} ${formatChange(bottom.change24h)} at ${formatPrice(bottom.price)}`,
  ];
  return { headline, points: top === bottom ? points.slice(0, 1) : points, source: "prices" };
}

export const WHATS_MOVING_SYSTEM_PROMPT = `You write the "What's moving" panel on an always-on trading TV that people glance at from across the room.

Use only the prices and headlines in the user message. Do not use outside knowledge about markets, prices, or events.
Explain a move only when a provided headline clearly supports it, and name that cause in plain words. When no headline supports a move, describe the move without giving a reason.
Do not give advice, predictions, or price targets.

Write a headline of at most 8 words and one to three points of at most 12 words each. Use ticker symbols, percentages with a sign, and no emoji.`;

// The user message for Claude: the board as a compact table plus the latest
// headlines, numbered so the model can lean on them.
export function buildWhatsMovingPrompt(items: WatchlistItem[], headlines: Headline[]): string {
  const board = items
    .map((i) => `${i.symbol} (${i.name}): ${formatPrice(i.price)}, ${formatChange(i.change24h)} 24h`)
    .join("\n");
  const news = headlines.length
    ? headlines.map((h, n) => `${n + 1}. [${h.source}] ${h.title}`).join("\n")
    : "(no headlines available)";
  return `Watchlist:\n${board}\n\nLatest headlines:\n${news}`;
}
