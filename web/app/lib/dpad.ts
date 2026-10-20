"use client";

import { useEffect, useRef } from "react";

export type DpadKey =
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "back"
  | "playPause"
  | "play"
  | "pause"
  | "next"
  | "previous";

// Fire TV remotes arrive in the Vega WebView as arrow keys (37–40) and Enter
// (13); the media buttons as MediaPlayPause (179), MediaFastForward (228) and
// MediaRewind (227). Next/Previous track never arrive from the remote, but are
// mapped in case other remotes or keyboards send them. Older WebViews may
// only set keyCode, so fall back to it.
const BY_KEY: Record<string, DpadKey> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "select",
  Backspace: "back",
  Escape: "back",
  GoBack: "back",
  BrowserBack: "back",
  MediaPlayPause: "playPause",
  MediaPlay: "play",
  MediaPause: "pause",
  MediaFastForward: "next",
  MediaTrackNext: "next",
  MediaRewind: "previous",
  MediaTrackPrevious: "previous",
};
const BY_KEY_CODE: Record<number, DpadKey> = {
  38: "up",
  40: "down",
  37: "left",
  39: "right",
  13: "select",
  27: "back",
  179: "playPause",
  228: "next",
  176: "next",
  227: "previous",
  177: "previous",
};

export function toDpadKey(event: KeyboardEvent): DpadKey | null {
  return BY_KEY[event.key] ?? BY_KEY_CODE[event.keyCode] ?? null;
}

// Listens for remote / D-pad presses on the whole page. Handled keys are
// prevented so the WebView's built-in spatial navigation never moves focus
// or scrolls behind our back; navigation is fully owned by app state.
export function useDpad(
  handlers: Partial<Record<DpadKey, () => void>>,
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = toDpadKey(event);
      const handler = key && handlersRef.current[key];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
