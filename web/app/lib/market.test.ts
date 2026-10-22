import { describe, expect, it } from "vitest";
import {
  mergeLive,
  WATCHLIST_SOURCES,
  buildWatchlist,
  parseCoinGeckoPrices,
  parseSymbolList,
  parseYahooQuote,
  resolveSource,
  tradesAroundTheClock,
  type Quote,
} from "./market";
import { pinFavorites } from "./watchlist";

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

  it("reads the short name and tidies its padding", () => {
    expect(
      parseYahooQuote(chart({ regularMarketPrice: 221.5, shortName: "NVIDIA CORP.     R" }))?.name,
    ).toBe("NVIDIA CORP. R");
    expect(parseYahooQuote(chart({ regularMarketPrice: 1, longName: "Apple Inc." }))?.name).toBe(
      "Apple Inc.",
    );
  });
});

describe("parseSymbolList", () => {
  it("uppercases, dedupes and drops invalid symbols", () => {
    expect(parseSymbolList("amzn, nvda,BTC,amzn,not a ticker")).toEqual(["AMZN", "NVDA", "BTC"]);
    expect(parseSymbolList("^GSPC,BRK-B,ADA-USD,GC=F")).toEqual(["^GSPC", "BRK-B", "ADA-USD", "GC=F"]);
  });

  it("caps the list at 10", () => {
    const many = Array.from({ length: 12 }, (_, i) => `S${i}`).join(",");
    expect(parseSymbolList(many)).toHaveLength(10);
  });

  it("returns null for nothing usable, meaning the default board", () => {
    expect(parseSymbolList(null)).toBeNull();
    expect(parseSymbolList("")).toBeNull();
    expect(parseSymbolList("!!,  ,")).toBeNull();
  });
});

describe("resolveSource", () => {
  it("keeps default-board coins on CoinGecko and sends the rest to Yahoo", () => {
    expect(resolveSource("BTC")).toMatchObject({ provider: "coingecko", id: "bitcoin" });
    expect(resolveSource("NVDA")).toEqual({ symbol: "NVDA", name: "NVDA", provider: "yahoo", id: "NVDA" });
  });

  it("knows which symbols trade around the clock", () => {
    expect(tradesAroundTheClock(resolveSource("ETH"))).toBe(true);
    expect(tradesAroundTheClock(resolveSource("ADA-USD"))).toBe(true);
    expect(tradesAroundTheClock(resolveSource("AMZN"))).toBe(false);
    expect(tradesAroundTheClock(resolveSource("NVDA"))).toBe(false);
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

  it("builds a picked list in its own order, naming new symbols from their quote", () => {
    const quotes = new Map<string, Quote>([
      ["NVDA", { price: 221.5, change24h: 1.2, name: "NVIDIA Corporation" }],
      ["AMZN", { price: 262, change24h: -0.5, name: "Amazon.com, Inc." }],
    ]);
    const sources = ["NVDA", "AMZN", "TSLA"].map(resolveSource);
    const { items, live } = buildWatchlist(quotes, [], sources);
    expect(items).toEqual([
      { symbol: "NVDA", name: "NVIDIA Corporation", price: 221.5, change24h: 1.2 },
      { symbol: "AMZN", name: "Amazon", price: 262, change24h: -0.5 },
      { symbol: "TSLA", name: "TSLA", price: 0, change24h: 0 },
    ]);
    expect(live).toEqual(["NVDA", "AMZN"]);
  });

  it("falls back to the previous value for symbols without a quote", () => {
    const fallback = [{ symbol: "ETH", name: "Ethereum", price: 2400, change24h: 3 }];
    const { items, live } = buildWatchlist(new Map(), fallback);
    expect(items.find((i) => i.symbol === "ETH")).toMatchObject({ price: 2400, change24h: 3 });
    expect(live).toEqual([]);
  });
});

describe("pinFavorites", () => {
  const items = ["AMZN", "BTC", "ETH", "SOL", "HYPE"].map((symbol) => ({ symbol }));

  it("moves favorites to the top, keeping each group's order", () => {
    expect(pinFavorites(items, ["HYPE", "BTC"]).map((i) => i.symbol)).toEqual([
      "BTC",
      "HYPE",
      "AMZN",
      "ETH",
      "SOL",
    ]);
  });

  it("leaves the list alone without favorites, and ignores unknown ones", () => {
    expect(pinFavorites(items, [])).toBe(items);
    expect(pinFavorites(items, ["NVDA"]).map((i) => i.symbol)).toEqual(items.map((i) => i.symbol));
  });
});

describe("mergeLive", () => {
  const item = (symbol: string, price: number, change24h = 0) => ({ symbol, name: symbol, price, change24h });

  it("keeps the shown price for symbols without a live quote", () => {
    const previous = [item("BTC", 81380, -2.1), item("AMZN", 250.38, -4.57)];
    const next = [item("BTC", 108420.15, 2.38), item("AMZN", 250.5, -4.5)];
    expect(mergeLive(previous, next, ["AMZN"])).toEqual([item("BTC", 81380, -2.1), item("AMZN", 250.5, -4.5)]);
  });

  it("takes the new value for a symbol it has never priced", () => {
    expect(mergeLive([], [item("NVDA", 0)], [])).toEqual([item("NVDA", 0)]);
    expect(mergeLive([item("NVDA", 0)], [item("NVDA", 180)], [])).toEqual([item("NVDA", 180)]);
  });
});
