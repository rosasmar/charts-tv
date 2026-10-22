"use client";

import { useEffect, useState } from "react";
import type { Candle, CandleInterval } from "./candles";

const URLS: Record<CandleInterval, string> = { "30m": "/api/candles", "1m": "/api/candles/1m" };

/** The routes cache 30-minute candles for ~5 minutes and 1-minute candles for
 * ~30 s; check back every 5 minutes and every minute respectively. */
const POLL_MS: Record<CandleInterval, number> = { "30m": 5 * 60_000, "1m": 60_000 };

const NONE: Record<string, Candle[]> = {};

// Candles for every watchlist symbol (the default board, or the picked list in
// `symbols`) at the given interval, from /api/candles, /api/candles/1m or
// /api/candles/custom. Candles already on screen are kept: when the list
// changes, and for any symbol a refresh comes back without (a rate-limited
// provider), so a chart never blanks out mid-viewing. Changing the interval
// does drop the old set, so one interval's candles are never shown under the
// other's caption. Nothing loads while the interval is still unknown (null,
// before hydration).
export function useCandles(
  symbols: string[] | null,
  interval: CandleInterval | null,
): Record<string, Candle[]> {
  const [loaded, setLoaded] = useState<{ interval: CandleInterval; candles: Record<string, Candle[]> }>();
  const url = !interval
    ? null
    : symbols
      ? `/api/candles/custom?symbols=${encodeURIComponent(symbols.join(","))}` +
        (interval === "1m" ? "&interval=1m" : "")
      : URLS[interval];

  useEffect(() => {
    if (!url || !interval) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Record<string, Candle[]> = await res.json();
        if (!cancelled && Object.keys(data).length) {
          setLoaded((previous) => ({
            interval,
            candles: previous?.interval === interval ? { ...previous.candles, ...data } : data,
          }));
        }
      } catch (error) {
        console.error(`[candles] refresh failed: ${error}`);
      }
    };
    load();
    const timer = setInterval(load, POLL_MS[interval]);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [url, interval]);

  return loaded && loaded.interval === interval ? loaded.candles : NONE;
}
