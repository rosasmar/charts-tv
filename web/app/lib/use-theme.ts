"use client";

import { useSyncExternalStore } from "react";
import {
  THEME_STORAGE_KEY,
  parseThemeSetting,
  readThemeOverride,
  type ThemeSetting,
} from "./theme";

// The theme picked from the phone, shared by the dashboard (which handles the
// phone command) and <Theme> (which applies it). The pairing code changes on
// every load, so the TV remembers the choice in localStorage; ?theme=
// overrides it for one page load. On the server and while hydrating the hook
// returns null, so the markup never mismatches and the theme the inline script
// already applied stays put until the real setting is known.
let setting: ThemeSetting | undefined;
const listeners = new Set<() => void>();

function readSaved(): ThemeSetting | null {
  try {
    return parseThemeSetting(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null; // Storage blocked (e.g. a private window): use the default.
  }
}

function getSnapshot(): ThemeSetting {
  setting ??= readThemeOverride(window.location.search) ?? readSaved() ?? "dark";
  return setting;
}

const getServerSnapshot = () => null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Switches the theme and remembers it for the next page load. */
export function setThemeSetting(next: ThemeSetting) {
  setting = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage blocked: the theme still applies until the page reloads.
  }
  for (const listener of listeners) listener();
}

export function useThemeSetting(): ThemeSetting | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
