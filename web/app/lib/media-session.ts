"use client";

import { useEffect, useRef } from "react";

type MediaHandlers = {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
};

// Alexa voice commands ("Alexa, pause", "Alexa, fast forward") reach a Vega
// WebView page through the W3C Media Session API, because the wrapper sets
// allowsDefaultMediaControl. Remote buttons do NOT come this way — they
// arrive as keydown events (see useDpad) — so register both.
// TODO: Verify on a real Fire TV with voice; the Vega Virtual Device has no
// way to inject an Alexa voice command, so this path is untested.
export function useMediaSession(
  handlers: MediaHandlers,
  { playing, title }: { playing: boolean; title: string },
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const actions: [MediaSessionAction, () => void][] = [
      ["play", () => handlersRef.current.play()],
      ["pause", () => handlersRef.current.pause()],
      ["seekforward", () => handlersRef.current.next()],
      ["seekbackward", () => handlersRef.current.previous()],
      ["nexttrack", () => handlersRef.current.next()],
      ["previoustrack", () => handlersRef.current.previous()],
    ];
    for (const [action, handler] of actions) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Unsupported action on this platform; skip it.
      }
    }
    return () => {
      for (const [action] of actions) {
        try {
          session.setActionHandler(action, null);
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    if ("MediaMetadata" in window) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: "TickerTV",
      });
    }
  }, [playing, title]);
}
