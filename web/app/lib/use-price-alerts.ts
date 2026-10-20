"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ALERT_RULES,
  evaluateAlerts,
  type AlertRule,
  type PriceAlert,
} from "./alerts";
import { playAlertSound, unlockAlertSound } from "./alert-sound";
import type { WatchlistItem } from "./watchlist";

/** How long each alert banner stays on screen. */
const ALERT_MS = 8_000;

// Watches the watchlist for threshold crossings and returns the alert to show
// right now. Alerts that fire together are queued and shown one after another.
// Sound is on unless the page URL has ?sound=0.
export function usePriceAlerts(
  items: WatchlistItem[],
  rules: AlertRule[] = DEFAULT_ALERT_RULES,
): PriceAlert | undefined {
  const previous = useRef<WatchlistItem[]>(undefined);
  const [queue, setQueue] = useState<PriceAlert[]>([]);

  useEffect(() => {
    const fired = evaluateAlerts(previous.current, items, rules);
    previous.current = items;
    if (fired.length) setQueue((q) => [...q, ...fired]);
  }, [items, rules]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    console.info(`[alert] ${current.title} (${current.detail})`);
    const soundOn = new URLSearchParams(window.location.search).get("sound") !== "0";
    if (soundOn) playAlertSound(current.direction);
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), ALERT_MS);
    return () => clearTimeout(timer);
  }, [current]);

  useEffect(() => {
    window.addEventListener("keydown", unlockAlertSound);
    return () => window.removeEventListener("keydown", unlockAlertSound);
  }, []);

  return current;
}
