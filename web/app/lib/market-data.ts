import "server-only";
import { cacheLife } from "next/cache";
import {
  WATCHLIST_SOURCES,
  buildWatchlist,
  parseCoinGeckoPrices,
  parseYahooQuote,
  type Quote,
} from "./market";
import type { WatchlistItem } from "./watchlist";

const USER_AGENT = "TickerTV/1.0 (+https://github.com/rosasmar/charts-tv)";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

// Crypto from CoinGecko's free API (one request for every coin), stocks from
// Yahoo Finance's chart endpoint. Each provider fails independently: a symbol
// without a fresh quote keeps its fallback value.
async function fetchQuotes(): Promise<Map<string, Quote>> {
  const quotes = new Map<string, Quote>();
  const coins = WATCHLIST_SOURCES.filter((s) => s.provider === "coingecko");
  const stocks = WATCHLIST_SOURCES.filter((s) => s.provider === "yahoo");

  const coinGecko = getJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coins.map((c) => c.id).join(",")}` +
      "&vs_currencies=usd&include_24hr_change=true",
  ).then((json) => {
    const byId = parseCoinGeckoPrices(json);
    for (const coin of coins) {
      const quote = byId.get(coin.id);
      if (quote) quotes.set(coin.symbol, quote);
    }
  });

  // TODO: Yahoo's chart endpoint is unofficial; switch to a keyed stock API
  // (e.g. Alpha Vantage or Finnhub) if it becomes unreliable.
  const yahoo = stocks.map((stock) =>
    getJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${stock.id}?interval=30m&range=1d`,
    ).then((json) => {
      const quote = parseYahooQuote(json);
      if (quote) quotes.set(stock.symbol, quote);
    }),
  );

  const results = await Promise.allSettled([coinGecko, ...yahoo]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn(`[market] quote fetch failed: ${result.reason}`);
    }
  }
  return quotes;
}

export type MarketData = {
  items: WatchlistItem[];
  /** Symbols whose price came from a live quote on this refresh. */
  live: string[];
  /** Epoch ms of this refresh. */
  updatedAt: number;
};

// Refreshed at most once a minute and shared by every TV, which keeps us well
// inside CoinGecko's free-tier rate limit no matter how many screens are on.
export async function getMarketData(): Promise<MarketData> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 600 });
  const { items, live } = buildWatchlist(await fetchQuotes());
  return { items, live, updatedAt: Date.now() };
}
