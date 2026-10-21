import "server-only";
import { cacheLife } from "next/cache";
import { parseCoinGeckoOhlc, parseYahooCandles, type Candle } from "./candles";
import { WATCHLIST_SOURCES } from "./market";

const USER_AGENT = "ChartsTV/1.0 (+https://github.com/rosasmar/charts-tv)";

async function fetchCandles(source: (typeof WATCHLIST_SOURCES)[number]): Promise<Candle[]> {
  // Crypto: 30-minute candles over the last day. Stocks: 30-minute candles
  // over the last five trading days (one day is only ~13 candles).
  const url =
    source.provider === "coingecko"
      ? `https://api.coingecko.com/api/v3/coins/${source.id}/ohlc?vs_currency=usd&days=1`
      : `https://query1.finance.yahoo.com/v8/finance/chart/${source.id}?interval=30m&range=5d`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${source.symbol}`);
  const json = await res.json();
  return source.provider === "coingecko" ? parseCoinGeckoOhlc(json) : parseYahooCandles(json);
}

// Candles for every watchlist symbol, refreshed at most every 5 minutes and
// shared by every TV. A symbol whose fetch fails is just missing; the chart
// shows a placeholder for it until the next refresh.
export async function getCandles(): Promise<Record<string, Candle[]>> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3_600 });
  const entries = await Promise.all(
    WATCHLIST_SOURCES.map(async (source) => {
      try {
        return [source.symbol, await fetchCandles(source)] as const;
      } catch (error) {
        console.warn(`[candles] ${source.symbol} failed: ${error}`);
        return [source.symbol, [] as Candle[]] as const;
      }
    }),
  );
  return Object.fromEntries(entries.filter(([, candles]) => candles.length > 0));
}
