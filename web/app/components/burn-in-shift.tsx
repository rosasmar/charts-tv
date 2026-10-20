"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PIXEL_SHIFT_INTERVAL_MS, pixelShiftOffset } from "@/app/lib/pixel-shift";

// Burn-in protection for an always-on screen: the whole layout drifts a few
// pixels to a new position every couple of minutes, slowly enough that nobody
// notices. The page's 3rem padding leaves room, so nothing gets clipped.
// ?shift=fast moves every 3 seconds instead, to see it working.
export function BurnInShift({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const fast = new URLSearchParams(window.location.search).get("shift") === "fast";
    const interval = fast ? 3_000 : PIXEL_SHIFT_INTERVAL_MS;
    const timer = setInterval(() => setStep((s) => s + 1), interval);
    return () => clearInterval(timer);
  }, []);

  const { xRem, yRem } = pixelShiftOffset(step);
  return (
    <div
      className={`transition-transform duration-[3000ms] ease-in-out ${className ?? ""}`}
      style={{ transform: `translate(${xRem}rem, ${yRem}rem)` }}
    >
      {children}
    </div>
  );
}
