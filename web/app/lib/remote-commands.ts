import { WATCHLIST_SOURCES } from "./market";

export type RemoteCommand =
  | { type: "select"; symbol: string }
  | { type: "next" }
  | { type: "previous" }
  | { type: "pause" }
  | { type: "play" }
  | { type: "alert"; symbol: string; direction: "up" | "down"; pct: number };

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

/**
 * Pure function: turns free text into a RemoteCommand or null.
 * R3 / R4 – case insensitive, filler words ignored.
 */
export function parseCommand(text: string): RemoteCommand | null {
  if (!text || text.length > 200) return null;

  const norm = normalise(text);

  // --- pause / stop / freeze ---
  if (/\b(pause|stop|freeze)\b/.test(norm)) return { type: "pause" };

  // --- play / resume / start / rotate ---
  if (/\b(play|resume|start|rotate)\b/.test(norm)) return { type: "play" };

  // --- next / skip ---
  if (/\b(next|skip)\b/.test(norm)) return { type: "next" };

  // --- previous / back ---
  if (/\b(previous|prev|back)\b/.test(norm)) return { type: "previous" };

  // --- alert: "alert me if bitcoin drops 5 percent" ---
  // Patterns: "alert [me] [if|when] <symbol> [is] (up|drops|down|rises|falls) <n> [%|percent]"
  const alertRe =
    /\b(?:alert|tell|notify|warn)\b.*?(?:\bif\b|\bwhen\b)?\s*(.+?)\s+(?:is\s+)?(up|rises?|surges?|gained?|drops?|falls?|down|loses?|down\s+by)\s+(\d+(?:\.\d+)?)\s*(?:%|percent(?:age)?)?/;
  const alertMatch = norm.match(alertRe);
  if (alertMatch) {
    const symbolHint = alertMatch[1];
    const dirWord = alertMatch[2];
    const pctStr = alertMatch[3];
    const sym = extractSymbol(symbolHint);
    if (sym) {
      const pct = parseFloat(pctStr);
      if (pct >= 1 && pct <= 50) {
        const direction =
          /\b(up|rises?|surges?|gained?)\b/.test(dirWord) ? "up" : "down";
        return { type: "alert", symbol: sym, direction, pct };
      }
    }
    return null;
  }

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
