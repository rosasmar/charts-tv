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
    <div className="rounded-[1.25rem] border border-panel-border bg-background/40 px-[1.75rem] py-[1rem]">
      <div className="flex items-baseline gap-[1.25rem]">
        <span className="shrink-0 text-[1.125rem] font-semibold uppercase tracking-[0.2em] text-muted">
          What&apos;s moving
        </span>
        <span className="min-w-0 flex-1 truncate text-[1.875rem] font-semibold tracking-tight">
          {summary.headline}
        </span>
        <span className="shrink-0 text-[1.125rem] text-muted">
          {summary.source === "claude" ? "Claude on Amazon Bedrock" : "From prices"}
        </span>
      </div>
      {summary.points.length > 0 && (
        <ul className="mt-[0.375rem] flex flex-wrap gap-x-[2rem] gap-y-[0.25rem] text-[1.375rem] text-foreground/80">
          {summary.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
