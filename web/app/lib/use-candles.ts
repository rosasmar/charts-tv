"use client";

import { useEffect, useState } from "react";
import type { Candle } from "./candles";

/** The route caches candles for ~5 minutes; check back at the same pace. */
const POLL_MS = 5 * 60_000;

// Candles for every watchlist symbol (the default board, or the picked list
// in `symbols`), from /api/candles or /api/candles/custom. Keeps the last
// good set if a refresh fails, and refetches at once when the list changes.
export function useCandles(symbols: string[] | null): Record<string, Candle[]> {
  const [candles, setCandles] = useState<Record<string, Candle[]>>({});
  const url = symbols
    ? `/api/candles/custom?symbols=${encodeURIComponent(symbols.join(","))}`
    : "/api/candles";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Record<string, Candle[]> = await res.json();
        if (!cancelled && Object.keys(data).length) setCandles(data);
      } catch (error) {
        console.error(`[candles] refresh failed: ${error}`);
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [url]);

  return candles;
}
