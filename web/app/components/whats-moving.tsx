"use client";

import { useEffect, useState } from "react";
import type { WhatsMoving } from "@/app/lib/whats-moving";

/** The route caches for ~10 minutes; check back at the same pace. */
const REFRESH_MS = 10 * 60_000;

// "What's moving": a one-line market headline plus a few points, written by
// Claude on Amazon Bedrock from the watchlist and the latest headlines (or a
// plain price summary when Claude isn't available). It covers the picked list
// in `symbols`, or the default board.
export function WhatsMovingPanel({ symbols }: { symbols: string[] | null }) {
  const [summary, setSummary] = useState<WhatsMoving>();
  const url = symbols
    ? `/api/whats-moving/custom?symbols=${encodeURIComponent(symbols.join(","))}`
    : "/api/whats-moving";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(url);
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
  }, [url]);

  if (!summary) return null;
  return (
    // One quiet line under the chart, set off by a hairline rather than a box,
    // so it reads as a caption and leaves the chart room to breathe.
    <div className="mt-[0.75rem] flex min-w-0 items-baseline gap-[1.25rem] border-t border-panel-border pt-[1.25rem]">
      <span className="shrink-0 text-[1.125rem] font-semibold uppercase tracking-[0.2em] text-muted">
        What&apos;s moving
      </span>
      <span className="shrink-0 text-[1.625rem] font-semibold tracking-tight">{summary.headline}</span>
      {summary.points.length > 0 && (
        <span className="min-w-0 flex-1 truncate text-[1.375rem] text-foreground/70">
          {summary.points.join("   ·   ")}
        </span>
      )}
      {/* Credit Claude when it wrote the summary; the price fallback needs no label. */}
      {summary.source === "claude" && (
        <span className="ml-auto shrink-0 text-[1.125rem] text-muted">Claude on Amazon Bedrock</span>
      )}
    </div>
  );
}
