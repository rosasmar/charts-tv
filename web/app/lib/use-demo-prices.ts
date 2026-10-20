"use client";

import { useEffect, useMemo, useState } from "react";
import type { WatchlistItem } from "./watchlist";

type DemoStep = {
  atMs: number;
  symbol: string;
  price: number;
  change24h: number;
};

// Scripted price moves for recording the demo video: AMZN breaks $230
// (an "up" alert), then DOGE drops past -5% (a "down" alert). They feed the
// real alert engine, so the banner path is exactly what live data would hit.
const DEMO_STEPS: DemoStep[] = [
  { atMs: 6_000, symbol: "AMZN", price: 230.42, change24h: 2.61 },
  { atMs: 22_000, symbol: "DOGE", price: 0.2016, change24h: -5.42 },
];

// Returns `items` unchanged unless the page URL has ?demo=1, in which case
// the scripted moves above are applied on a timer.
export function useDemoPrices(items: WatchlistItem[]): WatchlistItem[] {
  const [overrides, setOverrides] = useState<Record<string, DemoStep>>({});

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") !== "1") return;
    const timers = DEMO_STEPS.map((step) =>
      setTimeout(
        () => setOverrides((o) => ({ ...o, [step.symbol]: step })),
        step.atMs,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return useMemo(() => {
    if (Object.keys(overrides).length === 0) return items;
    return items.map((item) => {
      const step = overrides[item.symbol];
      return step
        ? { ...item, price: step.price, change24h: step.change24h }
        : item;
    });
  }, [items, overrides]);
}
