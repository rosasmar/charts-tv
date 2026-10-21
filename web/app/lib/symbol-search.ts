import { WATCHLIST_SOURCES, isValidSymbol } from "./market";

/** A search result the phone can add to the board. */
export type SymbolMatch = {
  symbol: string;
  name: string;
  kind: "Stock" | "ETF" | "Index" | "Crypto";
};

/** Most results the phone shows for one search. */
export const MAX_MATCHES = 8;

const KINDS: Record<string, SymbolMatch["kind"]> = {
  EQUITY: "Stock",
  ETF: "ETF",
  INDEX: "Index",
  CRYPTOCURRENCY: "Crypto",
};

// Default-board symbols whose ticker starts with, or whose name contains, the
// query. They come first so "bitcoin" finds BTC (priced from CoinGecko) before
// Yahoo's BTC-USD.
export function matchDefaultSymbols(query: string): SymbolMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return WATCHLIST_SOURCES.filter(
    (s) => s.symbol.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q),
  ).map((s) => ({
    symbol: s.symbol,
    name: s.name,
    kind: s.provider === "coingecko" ? "Crypto" : "Stock",
  }));
}

// Yahoo Finance /v1/finance/search → stocks, ETFs, indexes and US-dollar coin
// pairs. Foreign listings ("NVDA.TO", "APC.DE") are skipped because the board
// prices everything in dollars, and so are pairs for coins already on the
// default board ("BTC-USD"), which keep their CoinGecko prices.
export function parseYahooSearch(json: unknown): SymbolMatch[] {
  const quotes = (json as { quotes?: unknown })?.quotes;
  if (!Array.isArray(quotes)) return [];
  const defaults = new Set(WATCHLIST_SOURCES.map((s) => s.symbol));
  return quotes.flatMap((quote): SymbolMatch[] => {
    const { symbol, shortname, longname, quoteType } = (quote ?? {}) as Record<string, unknown>;
    const kind = typeof quoteType === "string" ? KINDS[quoteType] : undefined;
    if (!kind || typeof symbol !== "string" || !isValidSymbol(symbol)) return [];
    if (symbol.includes(".")) return [];
    if (kind === "Crypto" && (!symbol.endsWith("-USD") || defaults.has(symbol.slice(0, -4)))) {
      return [];
    }
    const raw = shortname ?? longname;
    const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
    return [{ symbol, name: name || symbol, kind }];
  });
}

/** Concatenates result lists, keeping the first of each symbol, up to MAX_MATCHES. */
export function mergeMatches(...lists: SymbolMatch[][]): SymbolMatch[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((m) => !seen.has(m.symbol) && seen.add(m.symbol))
    .slice(0, MAX_MATCHES);
}
