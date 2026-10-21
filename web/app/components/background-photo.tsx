"use client";

import { useEffect } from "react";
import { useBackground } from "@/app/lib/use-background";

// The viewer's photo behind the whole layout, set from the phone remote.
// It sits inside BurnInShift so it drifts with everything else, and overhangs
// the screen by 1rem so the drift never uncovers an edge. While a photo is
// set, <html data-background> turns the panels translucent (see globals.css),
// and --background-opacity makes them denser as the photo gets stronger. A
// scrim behind the header (dark, or light in the light theme) keeps the clock
// readable. Opacity and a gradient are cheap on TV GPUs, unlike a backdrop blur.
export function BackgroundPhoto() {
  const background = useBackground();
  const photo = background?.photo;
  const opacity = background?.opacity;

  useEffect(() => {
    const root = document.documentElement;
    if (!photo || opacity === undefined) return;
    root.dataset.background = "";
    root.style.setProperty("--background-opacity", String(opacity / 100));
    return () => {
      delete root.dataset.background;
      root.style.removeProperty("--background-opacity");
    };
  }, [photo, opacity]);

  if (!photo || opacity === undefined) return null;
  return (
    <div aria-hidden className="background-photo pointer-events-none fixed -inset-[1rem] -z-10">
      {/* A data URL from localStorage: next/image has nothing to optimize. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt=""
        decoding="async"
        className="h-full w-full object-cover transition-opacity duration-700"
        style={{ opacity: opacity / 100 }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[35%]"
        style={{
          background:
            "linear-gradient(to bottom, rgb(var(--scrim) / 0.8), rgb(var(--scrim) / 0.7) 55%, transparent)",
        }}
      />
    </div>
  );
}
