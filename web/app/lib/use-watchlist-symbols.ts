"use client";

import { useSyncExternalStore } from "react";
import { parseSymbolList } from "./market";

// Lists of symbols the viewer sets from the phone: their own board and their
// favorites. They're kept in localStorage because pairing codes only last for
// one page load, so the TV has to remember them itself. Storage can be
// missing or throw (private mode, a full quota), so every access is guarded
// and the board falls back to the default.
function storedSymbols(key: string) {
  let symbols: string[] | null | undefined;
  const listeners = new Set<() => void>();

  const read = (): string[] | null => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      return Array.isArray(stored) ? parseSymbolList(stored.join(",")) : null;
    } catch {
      return null;
    }
  };
  const getSnapshot = () => {
    if (symbols === undefined) symbols = read();
    return symbols;
  };
  // The server has nothing stored, so it renders the defaults and the TV's
  // own lists take over right after hydration.
  const getServerSnapshot = () => null;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const set = (next: string[]) => {
    symbols = next.length ? next : null;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Still applies for this session.
    }
    listeners.forEach((listener) => listener());
  };
  const useSymbols = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { set, useSymbols };
}

const watchlist = storedSymbols("chartstv:watchlist");
const favorites = storedSymbols("chartstv:favorites");
const NO_FAVORITES: string[] = [];

export const setWatchlistSymbols = watchlist.set;

/** The viewer's own board, or null for the default one. */
export const useWatchlistSymbols = watchlist.useSymbols;

export const setFavorites = favorites.set;

/** Symbols pinned to the top of the board. */
export function useFavorites(): string[] {
  return favorites.useSymbols() ?? NO_FAVORITES;
}
