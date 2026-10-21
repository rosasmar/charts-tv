import type { CandleInterval } from "./candles";
import { WATCHLIST_SOURCES } from "./market";

export type RemoteCommand =
  | { type: "select"; symbol: string }
  | { type: "next" }
  | { type: "previous" }
  | { type: "pause" }
  | { type: "play" }
  /** A percentage move alert; without a direction it fires either way. */
  | { type: "alert"; symbol: string; direction?: "up" | "down"; pct: number }
  /** A price-level alert; without a direction ("hits") the TV picks it from the current price. */
  | { type: "priceAlert"; symbol: string; price: number; direction?: "above" | "below" }
  /** Switches the chart between 30-minute and 1-minute candles. */
  | { type: "candles"; interval: CandleInterval };

/** Aliases: lowercase name / alias → ticker symbol. */
const ALIASES: Record<string, string> = {
  bitcoin: "BTC",
  btc: "BTC",
  ethereum: "ETH",
  ether: "ETH",
  eth: "ETH",
  solana: "SOL",
  sol: "SOL",
  xrp: "XRP",
  ripple: "XRP",
  dogecoin: "DOGE",
  doge: "DOGE",
  amazon: "AMZN",
  amzn: "AMZN",
  "amazon stock": "AMZN",
};

/** Build lookup: lowercase ticker and name → uppercase symbol. */
function buildSymbolMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const src of WATCHLIST_SOURCES) {
    map.set(src.symbol.toLowerCase(), src.symbol);
    map.set(src.name.toLowerCase(), src.symbol);
  }
  for (const [alias, sym] of Object.entries(ALIASES)) {
    map.set(alias, sym);
  }
  return map;
}

const SYMBOL_MAP = buildSymbolMap();

/** Strip filler words and normalise whitespace. */
const FILLER = /\b(?:me|please|can you|could you|would you|i want|i'd like|would like|a|the|to|for|is|it)\b/gi;

function normalise(text: string): string {
  return text.toLowerCase().replace(FILLER, " ").replace(/\s+/g, " ").trim();
}

/** Try to match any known symbol in a normalised text fragment. */
function extractSymbol(fragment: string): string | null {
  // Try exact full match first, then each word.
  const trimmed = fragment.trim();
  if (SYMBOL_MAP.has(trimmed)) return SYMBOL_MAP.get(trimmed)!;
  const words = trimmed.split(/\s+/);
  for (const w of words) {
    if (SYMBOL_MAP.has(w)) return SYMBOL_MAP.get(w)!;
  }
  return null;
}

const ALERT_VERB = /\b(?:alert|tell|notify|warn|ping)\b/;
const UP_WORDS = /\b(?:up|rises?|rising|surges?|gains?|gained|jumps?|climbs?|above|over|higher)\b/;
const DOWN_WORDS = /\b(?:down|drops?|dropping|falls?|falling|loses?|dips?|below|under|lower|sinks?)\b/;
const LEVEL_WORDS = /\b(?:hits?|reaches?|crosses|touches|at|above|over|below|under)\b/;
const PCT_RE = /(\d+(?:\.\d+)?)\s*(?:%|percent(?:age)?)/;
// A number, optionally with $, thousands separators or a k suffix.
const NUMBER_RE = /(\$)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k)?\b/;

// "1 minute candles", "one-minute chart", "switch to 1m candles" or just "1m"
// → 1m; the same with 30 / thirty → 30m. It needs "candles" or "chart" after
// the size (or the short "1m" / "30m"), so "pause for 1 minute" is still a
// pause.
const CANDLES_RE =
  /^(?:(?:show|switch|use|set|change|go)(?:\s+back)?\s+)?(?:(?:chart|candles)\s+)?(?:(1|one|30|thirty)[\s-]*(?:mins?|minutes?)[\s-]+(?:candles?|candlesticks?|chart)|(1|30)m(?:\s+(?:candles?|candlesticks?|chart))?)$/;

/**
 * "alert me if bitcoin drops 5 percent" → a percentage alert;
 * "alert me if btc hits 83,700" / "… goes above 84k" → a price-level alert.
 */
function parseAlert(norm: string): RemoteCommand | null {
  const symbol = extractSymbol(norm);
  if (!symbol) return null;
  const up = UP_WORDS.test(norm);
  const down = DOWN_WORDS.test(norm);
  const pctDirection = up && !down ? "up" : down && !up ? "down" : undefined;

  const pctMatch = norm.match(PCT_RE);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    if (!(pct >= 1 && pct <= 50)) return null;
    return { type: "alert", symbol, direction: pctDirection, pct };
  }

  const numberMatch = norm.match(NUMBER_RE);
  if (!numberMatch) return null;
  const value = parseFloat(numberMatch[2].replace(/,/g, "")) * (numberMatch[3] ? 1000 : 1);
  if (!(value > 0)) return null;

  // "drops 5" with no %, $ or level word: a percentage, as before.
  if (!numberMatch[1] && !numberMatch[3] && !LEVEL_WORDS.test(norm) && value <= 50) {
    if (value < 1) return null;
    return { type: "alert", symbol, direction: pctDirection, pct: value };
  }

  const direction = /\b(?:above|over|higher)\b/.test(norm) || (up && !down)
    ? "above"
    : /\b(?:below|under|lower)\b/.test(norm) || (down && !up)
      ? "below"
      : undefined;
  return { type: "priceAlert", symbol, price: value, direction };
}

/**
 * Pure function: turns free text into a RemoteCommand or null.
 * R3 / R4 – case insensitive, filler words ignored.
 */
export function parseCommand(text: string): RemoteCommand | null {
  if (!text || text.length > 200) return null;

  const norm = normalise(text);

  // --- alerts come first: phrases like "falls back to 100" or "stops at
  // 80k" must not be read as navigation commands. ---
  if (ALERT_VERB.test(norm)) return parseAlert(norm);

  // --- candle interval: before select, so "show 1 minute candles" isn't
  // read as an unknown symbol. ---
  const candlesMatch = norm.match(CANDLES_RE);
  if (candlesMatch) {
    const size = candlesMatch[1] ?? candlesMatch[2];
    return { type: "candles", interval: size === "1" || size === "one" ? "1m" : "30m" };
  }

  // --- pause / stop / freeze ---
  if (/\b(pause|stop|freeze)\b/.test(norm)) return { type: "pause" };

  // --- play / resume / start / rotate ---
  if (/\b(play|resume|start|rotate)\b/.test(norm)) return { type: "play" };

  // --- next / skip ---
  if (/\b(next|skip)\b/.test(norm)) return { type: "next" };

  // --- previous / back ---
  if (/\b(previous|prev|back)\b/.test(norm)) return { type: "previous" };

  // --- select: "show / switch to / go to / open / chart <symbol>" ---
  const selectRe =
    /\b(?:show|switch\s+to|go\s+to|open|chart|display|see)\b\s+(.+)/;
  const selectMatch = norm.match(selectRe);
  if (selectMatch) {
    const sym = extractSymbol(selectMatch[1]);
    if (sym) return { type: "select", symbol: sym };
    return null;
  }

  // --- bare ticker / name with no verb ---
  // e.g. "BTC" or "bitcoin" alone counts as select.
  const sym = extractSymbol(norm);
  if (sym) return { type: "select", symbol: sym };

  return null;
}
