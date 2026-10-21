import "server-only";
import { cacheLife } from "next/cache";
import {
  MINUTE_CANDLES,
  parseCoinGeckoOhlc,
  parseKrakenOhlc,
  parseYahooCandles,
  type Candle,
} from "./candles";
import { WATCHLIST_SOURCES, type SymbolSource } from "./market";

const USER_AGENT = "ChartsTV/1.0 (+https://github.com/rosasmar/charts-tv)";

async function getJson(url: string, symbol: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  return res.json();
}

async function fetchCandles(source: SymbolSource): Promise<Candle[]> {
  // Crypto: 30-minute candles over the last day. Stocks: 30-minute candles
  // over the last five trading days (one day is only ~13 candles).
  const url =
    source.provider === "coingecko"
      ? `https://api.coingecko.com/api/v3/coins/${source.id}/ohlc?vs_currency=usd&days=1`
      : `https://query1.finance.yahoo.com/v8/finance/chart/${source.id}?interval=30m&range=5d`;
  const json = await getJson(url, source.symbol);
  return source.provider === "coingecko" ? parseCoinGeckoOhlc(json) : parseYahooCandles(json);
}

// The last MINUTE_CANDLES 1-minute candles. CoinGecko's free OHLC stops at
// 30 minutes, so crypto comes from Kraken's public OHLC endpoint: keyless,
// reachable from US servers (unlike api.binance.com), spot USD prices that
// match the CoinGecko price folded into the last candle (Hyperliquid's perp
// prices sit a few dollars off, which shows on a 1-hour chart), and current to
// the minute (Coinbase's candles lag by minutes). Kraken resolves
// `${symbol}USD` itself (BTC → XXBTZUSD, DOGE → XDGUSD, HYPE → HYPEUSD), so a
// new coin needs no mapping if Kraken lists it in USD. Stocks: Yahoo's
// 1-minute bars for the latest session (the last one when the market is
// closed).
async function fetchMinuteCandles(source: SymbolSource): Promise<Candle[]> {
  const since = Math.floor(Date.now() / 1000) - (MINUTE_CANDLES + 5) * 60;
  const url =
    source.provider === "coingecko"
      ? `https://api.kraken.com/0/public/OHLC?pair=${source.symbol}USD&interval=1&since=${since}`
      : `https://query1.finance.yahoo.com/v8/finance/chart/${source.id}?interval=1m&range=1d`;
  const json = await getJson(url, source.symbol);
  const candles = source.provider === "coingecko" ? parseKrakenOhlc(json) : parseYahooCandles(json);
  return candles.slice(-MINUTE_CANDLES);
}

// Candles for every watchlist symbol. A symbol whose fetch fails is just
// missing; the chart shows a placeholder for it until the next refresh.
async function candlesBySymbol(
  fetchSymbol: (source: SymbolSource) => Promise<Candle[]>,
): Promise<Record<string, Candle[]>> {
  const entries = await Promise.all(
    WATCHLIST_SOURCES.map(async (source) => {
      try {
        return [source.symbol, await fetchSymbol(source)] as const;
      } catch (error) {
        console.warn(`[candles] ${source.symbol} failed: ${error}`);
        return [source.symbol, [] as Candle[]] as const;
      }
    }),
  );
  return Object.fromEntries(entries.filter(([, candles]) => candles.length > 0));
}

// 30-minute candles, refreshed at most every 5 minutes and shared by every TV.
export async function getCandles(): Promise<Record<string, Candle[]>> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3_600 });
  return candlesBySymbol(fetchCandles);
}

// 1-minute candles, refreshed at most every 30 s and shared by every TV: about
// a dozen upstream requests a minute however many screens are on, well inside
// Kraken's and Yahoo's public limits. An `expire` under 5 minutes would stop
// the route being prerendered and revalidated in the background.
export async function getMinuteCandles(): Promise<Record<string, Candle[]>> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 600 });
  return candlesBySymbol(fetchMinuteCandles);
}
