"use client";

import { useEffect, useMemo, useState } from "react";
import { mergeLive, resolveSource } from "./market";
import type { MarketData } from "./market-data";
import type { WatchlistItem } from "./watchlist";

/** The route refreshes at most once a minute; poll at the same pace. */
const POLL_MS = 60_000;

// Starts from the prices rendered into the page, then keeps them fresh by
// polling /api/market (or /api/market/custom for a picked list). A failed poll,
// or a symbol that came back without a live quote, keeps the last good price
// on screen.
// With a picked list (`symbols`), the board switches to it at once, reusing
// any prices it already has; the rest show a dash until the fetch, which
// starts immediately, comes back.
export function useLiveMarket(
  initial: WatchlistItem[],
  symbols: string[] | null,
): WatchlistItem[] {
  const [items, setItems] = useState(initial);
  const url = symbols
    ? `/api/market/custom?symbols=${encodeURIComponent(symbols.join(","))}`
    : "/api/market";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: MarketData = await res.json();
        if (!cancelled && data.items.length) {
          setItems((previous) => mergeLive(previous, data.items, data.live ?? []));
        }
      } catch (error) {
        console.error(`[market] refresh failed: ${error}`);
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [url]);

  return useMemo(
    () =>
      symbols
        ? symbols.map(
            (symbol) =>
              items.find((i) => i.symbol === symbol) ?? {
                symbol,
                name: resolveSource(symbol).name,
                price: 0,
                change24h: 0,
              },
          )
        : items,
    [items, symbols],
  );
}
