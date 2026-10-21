import { describe, expect, it } from "vitest";
import { matchDefaultSymbols, mergeMatches, parseYahooSearch } from "./symbol-search";

describe("matchDefaultSymbols", () => {
  it("matches a ticker prefix or part of a name", () => {
    expect(matchDefaultSymbols("bitcoin")).toEqual([
      { symbol: "BTC", name: "Bitcoin", kind: "Crypto" },
    ]);
    expect(matchDefaultSymbols("AM").map((m) => m.symbol)).toEqual(["AMZN"]);
    expect(matchDefaultSymbols("amazon")).toEqual([{ symbol: "AMZN", name: "Amazon", kind: "Stock" }]);
  });

  it("returns nothing for an empty query", () => {
    expect(matchDefaultSymbols("  ")).toEqual([]);
  });
});

describe("parseYahooSearch", () => {
  const search = (...quotes: Record<string, unknown>[]) => ({ quotes });

  it("keeps US stocks, ETFs, indexes and USD coin pairs", () => {
    expect(
      parseYahooSearch(
        search(
          { symbol: "NVDA", shortname: "NVIDIA Corporation", quoteType: "EQUITY" },
          { symbol: "VOO", shortname: "Vanguard S&P 500 ETF", quoteType: "ETF" },
          { symbol: "^GSPC", shortname: "S&P 500", quoteType: "INDEX" },
          { symbol: "ADA-USD", shortname: "Cardano USD", quoteType: "CRYPTOCURRENCY" },
        ),
      ),
    ).toEqual([
      { symbol: "NVDA", name: "NVIDIA Corporation", kind: "Stock" },
      { symbol: "VOO", name: "Vanguard S&P 500 ETF", kind: "ETF" },
      { symbol: "^GSPC", name: "S&P 500", kind: "Index" },
      { symbol: "ADA-USD", name: "Cardano USD", kind: "Crypto" },
    ]);
  });

  it("skips futures, foreign listings, non-USD pairs and default-board coins", () => {
    expect(
      parseYahooSearch(
        search(
          { symbol: "SNVDA=F", shortname: "NVIDIA future", quoteType: "FUTURE" },
          { symbol: "NVDA.TO", shortname: "NVIDIA CDR", quoteType: "EQUITY" },
          { symbol: "ADA-EUR", shortname: "Cardano EUR", quoteType: "CRYPTOCURRENCY" },
          { symbol: "BTC-USD", shortname: "Bitcoin USD", quoteType: "CRYPTOCURRENCY" },
        ),
      ),
    ).toEqual([]);
  });

  it("tidies padded names and falls back to the long name or the symbol", () => {
    expect(
      parseYahooSearch(
        search(
          { symbol: "NVD", shortname: "NVIDIA CORP.      R", quoteType: "EQUITY" },
          { symbol: "AAPL", longname: "Apple Inc.", quoteType: "EQUITY" },
          { symbol: "XYZ", quoteType: "EQUITY" },
        ),
      ).map((m) => m.name),
    ).toEqual(["NVIDIA CORP. R", "Apple Inc.", "XYZ"]);
  });

  it("returns nothing for an error payload", () => {
    expect(parseYahooSearch({ finance: { error: "x" } })).toEqual([]);
    expect(parseYahooSearch(null)).toEqual([]);
  });
});

describe("mergeMatches", () => {
  it("keeps the first of each symbol and caps the list", () => {
    const a = { symbol: "A", name: "First", kind: "Stock" as const };
    const many = Array.from({ length: 10 }, (_, i) => ({ ...a, symbol: `S${i}` }));
    expect(mergeMatches([a], [{ ...a, name: "Second" }])).toEqual([a]);
    expect(mergeMatches([a], many)).toHaveLength(8);
  });
});
