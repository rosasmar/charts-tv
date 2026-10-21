import { MOCK_WATCHLIST, type WatchlistItem } from "./watchlist";

/** Where each watchlist symbol's live price comes from. */
export type SymbolSource =
  | { symbol: string; name: string; provider: "coingecko"; id: string }
  | { symbol: string; name: string; provider: "yahoo"; id: string };

// The board until a viewer picks their own list from the phone. Its coins are
// also the ones priced from CoinGecko; any other symbol is a Yahoo ticker.
export const WATCHLIST_SOURCES: SymbolSource[] = [
  { symbol: "AMZN", name: "Amazon", provider: "yahoo", id: "AMZN" },
  { symbol: "BTC", name: "Bitcoin", provider: "coingecko", id: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", provider: "coingecko", id: "ethereum" },
  { symbol: "SOL", name: "Solana", provider: "coingecko", id: "solana" },
  { symbol: "XRP", name: "XRP", provider: "coingecko", id: "ripple" },
  { symbol: "DOGE", name: "Dogecoin", provider: "coingecko", id: "dogecoin" },
  { symbol: "HYPE", name: "Hyperliquid", provider: "coingecko", id: "hyperliquid" },
];

/** Most symbols a viewer can put on the board. */
export const MAX_WATCHLIST = 10;

// Yahoo-style tickers: NVDA, BRK-B, ^GSPC, ADA-USD, GC=F.
const SYMBOL_RE = /^[A-Z0-9^][A-Z0-9.=^-]{0,14}$/;

export function isValidSymbol(symbol: string): boolean {
  return SYMBOL_RE.test(symbol);
}

// A coin from the default board keeps its CoinGecko source; anything else is
// looked up on Yahoo Finance, which covers stocks, ETFs, indexes and "-USD"
// crypto pairs. Its name comes back with the quote.
export function resolveSource(symbol: string): SymbolSource {
  return (
    WATCHLIST_SOURCES.find((s) => s.symbol === symbol) ?? {
      symbol,
      name: symbol,
      provider: "yahoo",
      id: symbol,
    }
  );
}

// Crypto trades around the clock, so its chart covers 24 hours; a stock's
// trading day is only ~13 half-hour candles, so its chart covers five.
export function tradesAroundTheClock(source: SymbolSource): boolean {
  return source.provider === "coingecko" || source.id.endsWith("-USD");
}

// "amzn, nvda,BTC" → ["AMZN", "NVDA", "BTC"]: uppercased, deduped, invalid
// symbols dropped and capped at MAX_WATCHLIST. Null when nothing is left, which
// means the default board.
export function parseSymbolList(value: string | null | undefined): string[] | null {
  if (!value) return null;
  const symbols = [
    ...new Set(value.split(",").map((s) => s.trim().toUpperCase())),
  ].filter(isValidSymbol);
  return symbols.length ? symbols.slice(0, MAX_WATCHLIST) : null;
}

/** `name` is set for Yahoo quotes, which name the symbol. */
export type Quote = { price: number; change24h: number; name?: string };

// CoinGecko /simple/price?…&include_24hr_change=true →
// { bitcoin: { usd: 83212, usd_24h_change: 2.12 }, … }
export function parseCoinGeckoPrices(json: unknown): Map<string, Quote> {
  const quotes = new Map<string, Quote>();
  if (!json || typeof json !== "object") return quotes;
  for (const [id, value] of Object.entries(json as Record<string, unknown>)) {
    const v = value as { usd?: unknown; usd_24h_change?: unknown };
    if (typeof v?.usd === "number" && Number.isFinite(v.usd)) {
      quotes.set(id, {
        price: v.usd,
        change24h: typeof v.usd_24h_change === "number" ? v.usd_24h_change : 0,
      });
    }
  }
  return quotes;
}

// Yahoo Finance /v8/finance/chart/<symbol> → the latest price, the day's
// change versus the previous close, and the symbol's short name.
export function parseYahooQuote(json: unknown): Quote | undefined {
  const meta = (json as { chart?: { result?: { meta?: Record<string, unknown> }[] } })
    ?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number" || !Number.isFinite(price)) return undefined;
  const pct = meta?.regularMarketChangePercent;
  const prev = meta?.previousClose ?? meta?.chartPreviousClose;
  const change24h =
    typeof pct === "number"
      ? pct
      : typeof prev === "number" && prev > 0
        ? ((price - prev) / prev) * 100
        : 0;
  const rawName = meta?.shortName ?? meta?.longName;
  // Some short names come padded, e.g. "NVIDIA CORP.        R".
  const name = typeof rawName === "string" ? rawName.replace(/\s+/g, " ").trim() : "";
  return name ? { price, change24h, name } : { price, change24h };
}

// Builds the watchlist in `sources` order from whatever quotes came back. A
// symbol with no live quote keeps its fallback value (the last good one, or
// the mock on first load) so the board never has holes; one that has never
// been priced shows 0, which the tiles draw as a dash. Default-board symbols
// keep their short names ("Amazon"), others take Yahoo's.
export function buildWatchlist(
  quotes: Map<string, Quote>,
  fallback: WatchlistItem[] = MOCK_WATCHLIST,
  sources: SymbolSource[] = WATCHLIST_SOURCES,
): { items: WatchlistItem[]; live: string[] } {
  const live: string[] = [];
  const items = sources.map((source) => {
    const { symbol } = source;
    const quote = quotes.get(symbol);
    const old = fallback.find((i) => i.symbol === symbol);
    const custom = !WATCHLIST_SOURCES.includes(source);
    const name = (custom && (quote?.name ?? old?.name)) || source.name;
    if (quote) {
      live.push(symbol);
      return { symbol, name, price: quote.price, change24h: quote.change24h };
    }
    return { symbol, name, price: old?.price ?? 0, change24h: old?.change24h ?? 0 };
  });
  return { items, live };
}
