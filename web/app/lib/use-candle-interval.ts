"use client";

import { useSyncExternalStore } from "react";
import { isCandleInterval, readCandlesFlag, type CandleInterval } from "./candles";

const STORAGE_KEY = "chartstv:candles";

// The chart's candle interval: 30-minute unless chosen otherwise from the
// phone remote. The pairing code changes on every page load, so the TV keeps
// the choice in localStorage; without storage (blocked, or a locked-down
// WebView) it lasts until the next reload. ?candles=1m / ?candles=30m
// override the saved choice. On the server the hook returns null, so
// prerendering stays deterministic and hydration never mismatches.
let interval: CandleInterval | undefined;
const listeners = new Set<() => void>();

function readSaved(): CandleInterval | undefined {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isCandleInterval(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

function getSnapshot(): CandleInterval {
  interval ??= readCandlesFlag(window.location.search) ?? readSaved() ?? "30m";
  return interval;
}

const getServerSnapshot = () => null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setCandleInterval(next: CandleInterval) {
  interval = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // No storage: the choice holds until the page reloads.
  }
  for (const listener of listeners) listener();
}

export function useCandleInterval(): CandleInterval | null {
  return useSyncExternalStore<CandleInterval | null>(subscribe, getSnapshot, getServerSnapshot);
}
