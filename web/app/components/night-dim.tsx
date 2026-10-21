"use client";

import { useEffect, useState } from "react";
import { isNightTime, readDimSetting } from "@/app/lib/night-dim";

/** Black overlay opacity at night: 0.55 leaves the screen at ~45% brightness. */
const DIM_OPACITY = 0.55;

// Night dim for an always-on TV: from 22:00 to 07:00 local time a black layer
// fades in over the layout. An overlay is far cheaper on TV hardware than a
// CSS filter. Price alerts sit above it (z-50 vs z-40), so they still pop at
// full brightness. ?dim=on / ?dim=off override the schedule. It overhangs the
// screen by 1rem, like the background photo, so the burn-in drift never
// leaves an undimmed strip of photo at an edge.
export function NightDim() {
  const [dimmed, setDimmed] = useState(false);

  useEffect(() => {
    const setting = readDimSetting(window.location.search);
    const update = () =>
      setDimmed(setting === "on" || (setting === "auto" && isNightTime(new Date())));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      aria-hidden
      data-dimmed={dimmed}
      className="pointer-events-none fixed -inset-[1rem] z-40 bg-black transition-opacity duration-[2000ms]"
      style={{ opacity: dimmed ? DIM_OPACITY : 0 }}
    />
  );
}
