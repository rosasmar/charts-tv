import { MOCK_WATCHLIST, type WatchlistItem } from "./watchlist";

/** Where each watchlist symbol's live price comes from. */
export type SymbolSource =
  | { symbol: string; name: string; provider: "coingecko"; id: string }
  | { symbol: string; name: string; provider: "yahoo"; id: string };

export const WATCHLIST_SOURCES: SymbolSource[] = [
  { symbol: "AMZN", name: "Amazon", provider: "yahoo", id: "AMZN" },
  { symbol: "BTC", name: "Bitcoin", provider: "coingecko", id: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", provider: "coingecko", id: "ethereum" },
  { symbol: "SOL", name: "Solana", provider: "coingecko", id: "solana" },
  { symbol: "XRP", name: "XRP", provider: "coingecko", id: "ripple" },
  { symbol: "DOGE", name: "Dogecoin", provider: "coingecko", id: "dogecoin" },
];

export type Quote = { price: number; change24h: number };

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

// Yahoo Finance /v8/finance/chart/<symbol> → the latest price and the day's
// change versus the previous close.
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
  return { price, change24h };
}

// Builds the watchlist in WATCHLIST_SOURCES order from whatever quotes came
// back. A symbol with no live quote keeps its fallback value (the last good
// one, or the mock on first load) so the board never has holes.
export function buildWatchlist(
  quotes: Map<string, Quote>,
  fallback: WatchlistItem[] = MOCK_WATCHLIST,
): { items: WatchlistItem[]; live: string[] } {
  const live: string[] = [];
  const items = WATCHLIST_SOURCES.map(({ symbol, name }) => {
    const quote = quotes.get(symbol);
    if (quote) {
      live.push(symbol);
      return { symbol, name, ...quote };
    }
    const old = fallback.find((i) => i.symbol === symbol);
    return { symbol, name, price: old?.price ?? 0, change24h: old?.change24h ?? 0 };
  });
  return { items, live };
}
