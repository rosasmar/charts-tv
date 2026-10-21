"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AlertRule } from "./alerts";
import type { WatchlistItem } from "./watchlist";

type DemoStep = { atMs: number; symbol: string; price: number; change24h: number };
type DemoPlan = { steps: DemoStep[]; rules: AlertRule[] };

const round = (value: number, digits: number) => Number(value.toFixed(digits));

// Re-prices an item and adjusts its 24h change to match the new price.
function moveTo(item: WatchlistItem, price: number): { price: number; change24h: number } {
  const factor = price / item.price;
  return { price, change24h: round(((1 + item.change24h / 100) * factor - 1) * 100, 2) };
}

// The scripted moves for recording the demo, built around the live prices at
// load: AMZN breaks the next $5 line above it (an "up" alert), then DOGE drops
// through a line 3% below it (a "down" alert). They run through the real alert
// engine, with the matching rules, so the banners are exactly what live data
// would trigger.
export function buildDemoPlan(items: WatchlistItem[]): DemoPlan {
  const steps: DemoStep[] = [];
  const rules: AlertRule[] = [];

  const amzn = items.find((i) => i.symbol === "AMZN");
  if (amzn && amzn.price > 0) {
    const level = Math.floor(amzn.price / 5) * 5 + 5;
    steps.push({ atMs: 15_000, symbol: "AMZN", ...moveTo(amzn, round(level + 0.42, 2)) });
    rules.push({ symbol: "AMZN", kind: "above", price: level });
  }
  const doge = items.find((i) => i.symbol === "DOGE");
  if (doge && doge.price > 0) {
    const level = round(doge.price * 0.97, 4);
    steps.push({ atMs: 30_000, symbol: "DOGE", ...moveTo(doge, round(level * 0.996, 4)) });
    rules.push({ symbol: "DOGE", kind: "below", price: level });
  }
  return { steps, rules };
}

// Returns `items` unchanged unless the page URL has ?demo=1, in which case the
// scripted moves are applied on a timer and their alert rules are returned.
export function useDemoPrices(items: WatchlistItem[]): {
  items: WatchlistItem[];
  rules: AlertRule[];
} {
  const [overrides, setOverrides] = useState<Record<string, DemoStep>>({});
  const [rules, setRules] = useState<AlertRule[]>([]);
  const firstItems = useRef(items);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") !== "1") return;
    const plan = buildDemoPlan(firstItems.current);
    setRules(plan.rules);
    const timers = plan.steps.map((step) =>
      setTimeout(() => setOverrides((o) => ({ ...o, [step.symbol]: step })), step.atMs),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const demoItems = useMemo(() => {
    if (Object.keys(overrides).length === 0) return items;
    return items.map((item) => {
      const step = overrides[item.symbol];
      return step ? { ...item, price: step.price, change24h: step.change24h } : item;
    });
  }, [items, overrides]);

  return { items: demoItems, rules };
}
