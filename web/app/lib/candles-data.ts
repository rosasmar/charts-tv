import "server-only";
import { cacheLife } from "next/cache";
import {
  MINUTE_CANDLES,
  parseCoinGeckoOhlc,
  parseKrakenOhlc,
  parseYahooCandles,
  type Candle,
} from "./candles";
import { WATCHLIST_SOURCES, resolveSource, tradesAroundTheClock, type SymbolSource } from "./market";

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
      : `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(source.id)}` +
        `?interval=30m&range=${tradesAroundTheClock(source) ? "1d" : "5d"}`;
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
// new coin needs no mapping if Kraken lists it in USD. Everything else (stocks
// and picked "-USD" pairs): Yahoo's 1-minute bars for the latest session (the
// last one when the market is closed).
async function fetchMinuteCandles(source: SymbolSource): Promise<Candle[]> {
  const since = Math.floor(Date.now() / 1000) - (MINUTE_CANDLES + 5) * 60;
  const url =
    source.provider === "coingecko"
      ? `https://api.kraken.com/0/public/OHLC?pair=${source.symbol}USD&interval=1&since=${since}`
      : `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(source.id)}?interval=1m&range=1d`;
  const json = await getJson(url, source.symbol);
  const candles = source.provider === "coingecko" ? parseKrakenOhlc(json) : parseYahooCandles(json);
  return candles.slice(-MINUTE_CANDLES);
}

// One symbol's 30-minute candles, refreshed at most every 5 minutes and shared
// by every TV that shows it. A failed fetch is cached as no candles, so the
// chart shows its placeholder until the next refresh rather than retrying
// every request.
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

// One symbol's 1-minute candles, refreshed at most every 30 s: about a dozen
// upstream requests a minute for the default board however many screens are
// on, well inside Kraken's and Yahoo's public limits. An `expire` under 5
// minutes would stop /api/candles/1m being prerendered and revalidated in the
// background.
async function getSymbolMinuteCandles(symbol: string): Promise<Candle[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 600 });
  try {
    return await fetchMinuteCandles(resolveSource(symbol));
  } catch (error) {
    console.warn(`[candles] ${symbol} (1m) failed: ${error}`);
    return [];
  }
}

// Candles for the default board or a viewer's own list. A symbol whose fetch
// failed is just missing.
async function candlesBySymbol(
  symbols: string[] | null,
  getSymbol: (symbol: string) => Promise<Candle[]>,
): Promise<Record<string, Candle[]>> {
  const list = symbols ?? WATCHLIST_SOURCES.map((s) => s.symbol);
  const entries = await Promise.all(
    list.map(async (symbol) => [symbol, await getSymbol(symbol)] as const),
  );
  return Object.fromEntries(entries.filter(([, candles]) => candles.length > 0));
}

export async function getCandles(symbols: string[] | null = null): Promise<Record<string, Candle[]>> {
  return candlesBySymbol(symbols, getSymbolCandles);
}

export async function getMinuteCandles(
  symbols: string[] | null = null,
): Promise<Record<string, Candle[]>> {
  return candlesBySymbol(symbols, getSymbolMinuteCandles);
}
