"use client";

import { useEffect, useRef, useState } from "react";
import { Watchlist } from "@/app/components/watchlist";
import { useDpad } from "@/app/lib/dpad";
import type { WatchlistItem } from "@/app/lib/watchlist";

/** How long each symbol stays in the chart panel while auto-rotating. */
const ROTATE_MS = 10_000;
/** Remote use pauses rotation; it resumes after this much idle time. */
const RESUME_AFTER_MS = 30_000;

// The chart panel and watchlist, driven by the remote. Focus lives in state
// (not DOM focus) so navigation is deterministic: Up/Down move the highlight
// through the watchlist, OK shows the focused symbol in the chart panel.
// Left alone, the panel rotates through the watchlist so the screen stays
// alive on an always-on TV; touching the remote pauses it.
export function Dashboard({ items }: { items: WatchlistItem[] }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Any remote input holds rotation, and each press restarts the countdown.
  const holdRotation = () => {
    setHeld(true);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHeld(false), RESUME_AFTER_MS);
  };
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const rotating = !held && items.length > 1;
  useEffect(() => {
    if (!rotating) return;
    const timer = setTimeout(() => {
      const next = (selectedIndex + 1) % items.length;
      setSelectedIndex(next);
      setFocusedIndex(next);
    }, ROTATE_MS);
    return () => clearTimeout(timer);
  }, [rotating, selectedIndex, items.length]);

  useDpad({
    up: () => {
      holdRotation();
      setFocusedIndex((i) => Math.max(0, i - 1));
    },
    down: () => {
      holdRotation();
      setFocusedIndex((i) => Math.min(items.length - 1, i + 1));
    },
    select: () => {
      holdRotation();
      setSelectedIndex(focusedIndex);
    },
  });
  // TODO: Give the chart panel its own focus zone (Left/Right to move between
  // zones, remembering the last focused tile) once the chart has controls
  // such as timeframes.

  const selected = items[selectedIndex] ?? items[0];

  return (
    <main className="grid min-h-0 grid-cols-[1fr_34rem] gap-[2rem]">
      {/* TODO: Replace with the live candlestick chart for the selected
          symbol once the chart component lands. */}
      <section
        aria-label="Chart"
        className="relative flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-panel-border bg-panel p-[2.5rem]"
      >
        <div className="flex items-start justify-between">
          {selected && (
            <div className="text-[3rem] font-semibold leading-none">
              {selected.symbol}
              <span className="ml-4 text-[2rem] font-normal text-muted">
                {selected.name}
              </span>
            </div>
          )}
          <div className="text-[1.25rem] text-muted">
            {rotating ? "Auto-rotating" : "Paused"}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center text-[1.5rem] text-muted">
          Chart
        </div>
        {rotating && (
          <div
            // Restart the countdown bar each time the symbol changes.
            key={`${selectedIndex}-${held}`}
            aria-hidden
            className="rotate-progress absolute inset-x-0 bottom-0 h-[0.25rem] bg-white/40"
            style={{ animationDuration: `${ROTATE_MS}ms` }}
          />
        )}
      </section>

      <Watchlist
        items={items}
        focusedIndex={focusedIndex}
        selectedSymbol={selected?.symbol ?? ""}
      />
    </main>
  );
}
