import "server-only";
import { cacheLife } from "next/cache";
import { parseCoinGeckoOhlc, parseYahooCandles, type Candle } from "./candles";
import { WATCHLIST_SOURCES, resolveSource, tradesAroundTheClock, type SymbolSource } from "./market";

const USER_AGENT = "ChartsTV/1.0 (+https://github.com/rosasmar/charts-tv)";

async function fetchCandles(source: SymbolSource): Promise<Candle[]> {
  // Crypto: 30-minute candles over the last day. Stocks: 30-minute candles
  // over the last five trading days (one day is only ~13 candles).
  const url =
    source.provider === "coingecko"
      ? `https://api.coingecko.com/api/v3/coins/${source.id}/ohlc?vs_currency=usd&days=1`
      : `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(source.id)}` +
        `?interval=30m&range=${tradesAroundTheClock(source) ? "1d" : "5d"}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${source.symbol}`);
  const json = await res.json();
  return source.provider === "coingecko" ? parseCoinGeckoOhlc(json) : parseYahooCandles(json);
}

// One symbol's candles, refreshed at most every 5 minutes and shared by every
// TV that shows it. A failed fetch is cached as no candles, so the chart shows
// its placeholder until the next refresh rather than retrying every request.
async function getSymbolCandles(symbol: string): Promise<Candle[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3_600 });
  try {
    return await fetchCandles(resolveSource(symbol));
  } catch (error) {
    console.warn(`[candles] ${symbol} failed: ${error}`);
    return [];
  }
}

// Candles for the default board or a viewer's own list. A symbol whose fetch
// failed is just missing.
export async function getCandles(symbols: string[] | null = null): Promise<Record<string, Candle[]>> {
  const list = symbols ?? WATCHLIST_SOURCES.map((s) => s.symbol);
  const entries = await Promise.all(
    list.map(async (symbol) => [symbol, await getSymbolCandles(symbol)] as const),
  );
  return Object.fromEntries(entries.filter(([, candles]) => candles.length > 0));
}
