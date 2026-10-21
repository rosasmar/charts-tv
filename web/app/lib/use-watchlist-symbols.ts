"use client";

import { useSyncExternalStore } from "react";
import { parseSymbolList } from "./market";

const STORAGE_KEY = "chartstv:watchlist";

// The viewer's own board, picked on the phone, or null for the default one.
// It's kept in localStorage because pairing codes only last for one page
// load, so the TV has to remember the list itself. Storage can be missing or
// throw (private mode, a full quota), so every access is guarded and the
// board falls back to the default.
let symbols: string[] | null | undefined;
const listeners = new Set<() => void>();

function read(): string[] | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(stored) ? parseSymbolList(stored.join(",")) : null;
  } catch {
    return null;
  }
}

function getSnapshot(): string[] | null {
  if (symbols === undefined) symbols = read();
  return symbols;
}

// The server has no stored list, so it renders the default board and the
// TV's own list takes over right after hydration.
const getServerSnapshot = () => null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setWatchlistSymbols(next: string[]) {
  symbols = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

export function useWatchlistSymbols(): string[] | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
