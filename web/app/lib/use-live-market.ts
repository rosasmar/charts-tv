"use client";

import { useEffect, useState } from "react";
import type { MarketData } from "./market-data";
import type { WatchlistItem } from "./watchlist";

/** The route refreshes at most once a minute; poll at the same pace. */
const POLL_MS = 60_000;

// Starts from the prices rendered into the page, then keeps them fresh by
// polling /api/market. A failed poll keeps the last good prices on screen.
export function useLiveMarket(initial: WatchlistItem[]): WatchlistItem[] {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/market");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: MarketData = await res.json();
        if (!cancelled && data.items.length) setItems(data.items);
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
  }, []);

  return items;
}
