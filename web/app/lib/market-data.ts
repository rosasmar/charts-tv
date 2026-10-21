import "server-only";
import { cacheLife } from "next/cache";
import {
  WATCHLIST_SOURCES,
  buildWatchlist,
  parseCoinGeckoPrices,
  parseYahooQuote,
  resolveSource,
  type Quote,
  type SymbolSource,
} from "./market";
import { MOCK_WATCHLIST, type WatchlistItem } from "./watchlist";

const USER_AGENT = "ChartsTV/1.0 (+https://github.com/rosasmar/charts-tv)";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

// Every CoinGecko coin in one request, shared by every board whatever its
// list, which keeps us well inside CoinGecko's free-tier rate limit. A failed
// fetch is cached too (as no quotes) so a provider outage isn't retried on
// every request.
async function fetchCoinQuotes(): Promise<Record<string, Quote>> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 600 });
  const coins = WATCHLIST_SOURCES.filter((s) => s.provider === "coingecko");
  try {
    const byId = parseCoinGeckoPrices(
      await getJson(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coins.map((c) => c.id).join(",")}` +
          "&vs_currencies=usd&include_24hr_change=true",
      ),
    );
    return Object.fromEntries(
      coins.flatMap((coin) => {
        const quote = byId.get(coin.id);
        return quote ? [[coin.symbol, quote]] : [];
      }),
    );
  } catch (error) {
    console.warn(`[market] CoinGecko fetch failed: ${error}`);
    return {};
  }
}

// One Yahoo ticker, cached per ticker so boards that share a symbol share the
// request.
// TODO: Yahoo's chart endpoint is unofficial; switch to a keyed stock API
// (e.g. Alpha Vantage or Finnhub) if it becomes unreliable.
async function fetchYahooQuote(ticker: string): Promise<Quote | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 600 });
  try {
    return (
      parseYahooQuote(
        await getJson(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=30m&range=1d`,
        ),
      ) ?? null
    );
  } catch (error) {
    console.warn(`[market] Yahoo fetch failed for ${ticker}: ${error}`);
    return null;
  }
}

// Each symbol fails independently: one without a fresh quote keeps its
// fallback value.
async function fetchQuotes(sources: SymbolSource[]): Promise<Map<string, Quote>> {
  const stocks = sources.filter((s) => s.provider === "yahoo");
  const [coins, stockQuotes] = await Promise.all([
    sources.some((s) => s.provider === "coingecko") ? fetchCoinQuotes() : {},
    Promise.all(stocks.map((s) => fetchYahooQuote(s.id))),
  ]);
  const quotes = new Map<string, Quote>(Object.entries(coins));
  stocks.forEach((stock, i) => {
    const quote = stockQuotes[i];
    if (quote) quotes.set(stock.symbol, quote);
  });
  return quotes;
}

export type MarketData = {
  items: WatchlistItem[];
  /** Symbols whose price came from a live quote on this refresh. */
  live: string[];
  /** Epoch ms of this refresh. */
  updatedAt: number;
};

// The default board, or a viewer's own list of symbols. Refreshed at most once
// a minute per list and shared by every TV showing that list; the quotes
// underneath are shared across lists (see above).
export async function getMarketData(symbols: string[] | null = null): Promise<MarketData> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 600 });
  const sources = symbols ? symbols.map(resolveSource) : WATCHLIST_SOURCES;
  const { items, live } = buildWatchlist(await fetchQuotes(sources), MOCK_WATCHLIST, sources);
  return { items, live, updatedAt: Date.now() };
}
