"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  formatChange,
  formatPrice,
  type WatchlistItem,
} from "@/app/lib/watchlist";

type Props = {
  items: WatchlistItem[];
  focusedIndex: number;
  selectedSymbol: string;
  /** True while the viewer is using the remote; shows the focus ring. */
  navigating: boolean;
};

// Right-hand column of tiles, one per symbol, sized to read from 10 feet.
// A single highlight springs from tile to tile instead of each tile drawing
// its own focus ring, so focus is obvious from across the room. While the
// board just rotates, only the glow shows; the ring fades in on input.
export function Watchlist({ items, focusedIndex, selectedSymbol, navigating }: Props) {
  const tileRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [highlight, setHighlight] = useState<{ top: number; height: number }>();

  useLayoutEffect(() => {
    const measure = () => {
      const tile = tileRefs.current[focusedIndex];
      if (tile) setHighlight({ top: tile.offsetTop, height: tile.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [focusedIndex, items.length]);

  const focused = items[focusedIndex];
  const glow = focused && focused.change24h < 0 ? "var(--down)" : "var(--up)";

  return (
    <ul
      aria-label="Watchlist"
      role="listbox"
      aria-activedescendant={focused ? `tile-${focused.symbol}` : undefined}
      className="relative flex min-h-0 flex-col gap-[1rem]"
    >
      {items.map((item, index) => (
        <li
          key={item.symbol}
          id={`tile-${item.symbol}`}
          role="option"
          aria-selected={item.symbol === selectedSymbol}
          ref={(el) => {
            tileRefs.current[index] = el;
          }}
          className={`flex-1 transition-transform duration-300 ${
            index === focusedIndex ? "scale-[1.03]" : ""
          }`}
        >
          <WatchlistTile
            item={item}
            // When idle, the glow already marks the selected tile; the bar
            // only matters while focus can sit on a different tile.
            selected={item.symbol === selectedSymbol && (navigating || index !== focusedIndex)}
          />
        </li>
      ))}
      {highlight && (
        <li
          aria-hidden
          role="presentation"
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 rounded-[1.5rem] border-2 bg-highlight/[0.06] transition-[transform,height,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            navigating ? "border-highlight/80" : "border-transparent"
          }`}
          style={{
            height: highlight.height,
            transform: `translateY(${highlight.top}px) scale(1.03)`,
            boxShadow: `0 0 2.5rem -0.5rem ${glow}`,
          }}
        />
      )}
    </ul>
  );
}

function WatchlistTile({
  item,
  selected,
}: {
  item: WatchlistItem;
  selected: boolean;
}) {
  const up = item.change24h >= 0;
  return (
    <div className="relative flex h-full items-center justify-between rounded-[1.5rem] border border-panel-border bg-panel px-[2rem]">
      {selected && (
        <div
          aria-hidden
          className="absolute inset-y-[1.25rem] left-0 w-[0.375rem] rounded-r-full bg-highlight"
        />
      )}
      <div>
        <div className="text-[2.5rem] font-semibold leading-none">
          {item.symbol}
        </div>
        <div className="mt-[0.5rem] text-[1.25rem] text-muted">{item.name}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[2.25rem] leading-none tabular-nums">
          {formatPrice(item.price)}
        </div>
        <div
          className={`mt-[0.5rem] font-mono text-[1.5rem] tabular-nums ${
            up ? "text-up" : "text-down"
          }`}
        >
          {formatChange(item.change24h)}
        </div>
      </div>
    </div>
  );
}
