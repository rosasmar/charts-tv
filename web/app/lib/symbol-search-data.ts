import "server-only";
import { cacheLife } from "next/cache";
import {
  matchDefaultSymbols,
  mergeMatches,
  parseYahooSearch,
  type SymbolMatch,
} from "./symbol-search";

const USER_AGENT = "ChartsTV/1.0 (+https://github.com/rosasmar/charts-tv)";

// Yahoo's search results barely change, so a query is cached for a day and
// shared by every phone. A failed search throws, which isn't cached.
// TODO: Like the chart endpoint, Yahoo's search is unofficial; move it with
// quotes if we switch to a keyed stock API.
async function fetchYahooSearch(query: string): Promise<SymbolMatch[]> {
  "use cache";
  cacheLife({ stale: 3_600, revalidate: 86_400, expire: 7 * 86_400 });
  const url =
    "https://query1.finance.yahoo.com/v1/finance/search" +
    `?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from Yahoo search`);
  return parseYahooSearch(await res.json());
}

// The phone's "add a symbol" search: default-board matches first, then Yahoo.
// If Yahoo fails the default-board matches still come back.
export async function searchSymbols(query: string): Promise<SymbolMatch[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  try {
    return mergeMatches(matchDefaultSymbols(q), await fetchYahooSearch(q));
  } catch (error) {
    console.warn(`[symbols] search failed for "${q}": ${error}`);
    return mergeMatches(matchDefaultSymbols(q));
  }
}
