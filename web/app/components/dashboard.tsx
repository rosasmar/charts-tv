"use client";

import { useState } from "react";
import { Watchlist } from "@/app/components/watchlist";
import { useDpad } from "@/app/lib/dpad";
import type { WatchlistItem } from "@/app/lib/watchlist";

// The chart panel and watchlist, driven by the remote. Focus lives in state
// (not DOM focus) so navigation is deterministic: Up/Down move the highlight
// through the watchlist, OK shows the focused symbol in the chart panel.
export function Dashboard({ items }: { items: WatchlistItem[] }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState(items[0]?.symbol);

  useDpad({
    up: () => setFocusedIndex((i) => Math.max(0, i - 1)),
    down: () => setFocusedIndex((i) => Math.min(items.length - 1, i + 1)),
    select: () => setSelectedSymbol(items[focusedIndex]?.symbol),
  });
  // TODO: Give the chart panel its own focus zone (Left/Right to move between
  // zones, remembering the last focused tile) once the chart has controls
  // such as timeframes.

  const selected =
    items.find((item) => item.symbol === selectedSymbol) ?? items[0];

  return (
    <main className="grid min-h-0 grid-cols-[1fr_34rem] gap-[2rem]">
      {/* TODO: Replace with the live candlestick chart for the selected
          symbol once the chart component lands. */}
      <section
        aria-label="Chart"
        className="flex min-h-0 flex-col rounded-[2rem] border border-panel-border bg-panel p-[2.5rem]"
      >
        {selected && (
          <div className="text-[3rem] font-semibold leading-none">
            {selected.symbol}
            <span className="ml-4 text-[2rem] font-normal text-muted">
              {selected.name}
            </span>
          </div>
        )}
        <div className="flex flex-1 items-center justify-center text-[1.5rem] text-muted">
          Chart
        </div>
      </section>

      <Watchlist
        items={items}
        focusedIndex={focusedIndex}
        selectedSymbol={selected?.symbol ?? ""}
      />
    </main>
  );
}
