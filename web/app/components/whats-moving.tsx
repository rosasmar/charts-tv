"use client";

import { useEffect, useState } from "react";
import type { WhatsMoving } from "@/app/lib/whats-moving";

/** The route caches for ~10 minutes; check back at the same pace. */
const REFRESH_MS = 10 * 60_000;

// "What's moving": a one-line market headline plus a few points, written by
// Claude on Amazon Bedrock from the watchlist and the latest headlines (or a
// plain price summary when Claude isn't available).
export function WhatsMovingPanel() {
  const [summary, setSummary] = useState<WhatsMoving>();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/whats-moving");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: WhatsMoving = await res.json();
        if (!cancelled) setSummary(data);
      } catch (error) {
        console.error(`[whats-moving] failed to load: ${error}`);
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!summary) return null;
  return (
    <div className="rounded-[1.5rem] border border-panel-border bg-black/40 px-[2rem] py-[1.5rem]">
      <div className="flex items-center justify-between text-[1.25rem] font-semibold uppercase tracking-[0.2em] text-muted">
        <span>What&apos;s moving</span>
        <span className="normal-case tracking-normal font-normal">
          {summary.source === "claude" ? "Claude on Amazon Bedrock" : "From prices"}
        </span>
      </div>
      <div className="mt-[0.75rem] text-[2.25rem] font-semibold leading-tight tracking-tight">
        {summary.headline}
      </div>
      {summary.points.length > 0 && (
        <ul className="mt-[0.75rem] space-y-[0.25rem] text-[1.5rem] text-foreground/80">
          {summary.points.map((point) => (
            <li key={point} className="flex gap-[0.75rem]">
              <span aria-hidden className="text-muted">
                –
              </span>
              {point}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
