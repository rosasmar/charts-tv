"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_BACKGROUND_OPACITY, isValidOpacity } from "./background";

// The viewer's background photo (a data URL) and its opacity, set from the
// phone remote. Both are kept in localStorage so they survive a reload: the
// pairing code changes on every load, and the server deletes the photo once
// the TV has it. Read lazily in the browser; on the server the hook returns
// null, so prerendering shows no photo and hydration never mismatches.
const PHOTO_KEY = "chartstv:background";
const OPACITY_KEY = "chartstv:background-opacity";

export type Background = { photo: string | null; opacity: number };

let background: Background | undefined;
const listeners = new Set<() => void>();
// Bumped by clearBackground, so a photo still downloading when the viewer
// removes the background doesn't pop back up afterwards.
let generation = 0;

// Storage can throw (disabled, private mode, quota), so every access is
// guarded; the background then just lasts for this page load.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function getSnapshot(): Background {
  if (!background) {
    const opacity = Number(read(OPACITY_KEY) ?? NaN);
    background = {
      photo: read(PHOTO_KEY),
      opacity: isValidOpacity(opacity) ? opacity : DEFAULT_BACKGROUND_OPACITY,
    };
  }
  return background;
}

const getServerSnapshot = () => null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(next: Partial<Background>) {
  background = { ...getSnapshot(), ...next };
  for (const listener of listeners) listener();
}

export function useBackground(): Background | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setBackgroundOpacity(pct: number) {
  if (!isValidOpacity(pct)) return;
  write(OPACITY_KEY, String(pct));
  update({ opacity: pct });
}

/** Back to the plain black screen; the next photo starts at the default opacity. */
export function clearBackground() {
  generation++;
  write(PHOTO_KEY, null);
  write(OPACITY_KEY, null);
  update({ photo: null, opacity: DEFAULT_BACKGROUND_OPACITY });
}

function setPhoto(dataUrl: string) {
  if (!write(PHOTO_KEY, dataUrl)) {
    // Too big for storage: show it for now, and drop any older photo so a
    // reload doesn't bring that one back instead.
    write(PHOTO_KEY, null);
    console.warn("[background] couldn't save the photo; it lasts until reload");
  }
  update({ photo: dataUrl });
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches the photo the phone just uploaded. The server hands it over once
 * and deletes it, so from here on it lives only on this TV.
 */
export async function loadRemoteBackground(code: string) {
  const started = generation;
  try {
    const res = await fetch(`/api/remote/${code}/background`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dataUrl = await toDataUrl(await res.blob());
    if (started === generation) setPhoto(dataUrl);
  } catch (error) {
    console.error(`[background] failed to load the photo: ${error}`);
  }
}
