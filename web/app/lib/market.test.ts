import { describe, expect, it } from "vitest";
import {
  WATCHLIST_SOURCES,
  buildWatchlist,
  parseCoinGeckoPrices,
  parseYahooQuote,
  type Quote,
} from "./market";

describe("parseCoinGeckoPrices", () => {
  it("reads usd price and 24h change per coin id", () => {
    const quotes = parseCoinGeckoPrices({
      bitcoin: { usd: 83212, usd_24h_change: 2.12 },
      dogecoin: { usd: 0.081624, usd_24h_change: -3.4 },
    });
    expect(quotes.get("bitcoin")).toEqual({ price: 83212, change24h: 2.12 });
    expect(quotes.get("dogecoin")).toEqual({ price: 0.081624, change24h: -3.4 });
  });

  it("skips coins without a numeric price and defaults a missing change to 0", () => {
    const quotes = parseCoinGeckoPrices({
      ethereum: { usd: 2446.9 },
      broken: { usd: "n/a" },
    });
    expect(quotes.get("ethereum")).toEqual({ price: 2446.9, change24h: 0 });
    expect(quotes.has("broken")).toBe(false);
  });

  it("returns nothing for an error payload", () => {
    expect(parseCoinGeckoPrices({ status: { error_code: 429 } }).size).toBe(0);
    expect(parseCoinGeckoPrices(null).size).toBe(0);
  });
});

describe("parseYahooQuote", () => {
  const chart = (meta: Record<string, unknown>) => ({ chart: { result: [{ meta }] } });

  it("uses regularMarketChangePercent when present", () => {
    expect(
      parseYahooQuote(chart({ regularMarketPrice: 262.63, regularMarketChangePercent: 0.07 })),
    ).toEqual({ price: 262.63, change24h: 0.07 });
  });

  it("falls back to the previous close for the change", () => {
    const quote = parseYahooQuote(chart({ regularMarketPrice: 110, previousClose: 100 }));
    expect(quote?.price).toBe(110);
    expect(quote?.change24h).toBeCloseTo(10);
  });

  it("returns undefined for an error or empty result", () => {
    expect(parseYahooQuote({ chart: { result: null, error: { code: "Not Found" } } })).toBeUndefined();
    expect(parseYahooQuote(chart({}))).toBeUndefined();
  });
});

describe("buildWatchlist", () => {
  it("keeps the configured order and marks which symbols are live", () => {
    const quotes = new Map<string, Quote>([
      ["BTC", { price: 83000, change24h: 1 }],
      ["AMZN", { price: 262, change24h: -0.5 }],
    ]);
    const { items, live } = buildWatchlist(quotes);
    expect(items.map((i) => i.symbol)).toEqual(WATCHLIST_SOURCES.map((s) => s.symbol));
    expect(items[0]).toEqual({ symbol: "AMZN", name: "Amazon", price: 262, change24h: -0.5 });
    expect(live).toEqual(["AMZN", "BTC"]);
  });

  it("falls back to the previous value for symbols without a quote", () => {
    const fallback = [{ symbol: "ETH", name: "Ethereum", price: 2400, change24h: 3 }];
    const { items, live } = buildWatchlist(new Map(), fallback);
    expect(items.find((i) => i.symbol === "ETH")).toMatchObject({ price: 2400, change24h: 3 });
    expect(live).toEqual([]);
  });
});
