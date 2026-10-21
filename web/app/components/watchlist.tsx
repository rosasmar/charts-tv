"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  formatChange,
  formatPrice,
  type WatchlistItem,
} from "@/app/lib/watchlist";

type Props = {
  items: WatchlistItem[];
  /** Symbols pinned to the top; their tiles show a star. */
  favorites: string[];
  focusedIndex: number;
  selectedSymbol: string;
  /** True while the viewer is using the remote; shows the focus ring. */
  navigating: boolean;
};

/** The column fits this many full-size tiles; longer lists get compact ones. */
const FULL_SIZE_TILES = 7;

// Right-hand column of tiles, one per symbol, sized to read from 10 feet.
// A single highlight springs from tile to tile instead of each tile drawing
// its own focus ring, so focus is obvious from across the room. While the
// board just rotates, only the glow shows; the ring fades in on input.
export function Watchlist({ items, favorites, focusedIndex, selectedSymbol, navigating }: Props) {
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
  const compact = items.length > FULL_SIZE_TILES;
  const glow = focused && focused.change24h < 0 ? "var(--down)" : "var(--up)";

  return (
    <ul
      aria-label="Watchlist"
      role="listbox"
      aria-activedescendant={focused ? `tile-${focused.symbol}` : undefined}
      className={`relative flex min-h-0 flex-col ${compact ? "gap-[0.5rem]" : "gap-[1rem]"}`}
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
            compact={compact}
            favorite={favorites.includes(item.symbol)}
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

// Compact tiles (8–10 symbols) keep the same layout with smaller type, so a
// full list of 10 still fits the column at 1080p.
const FULL_SIZE = {
  padding: "px-[2rem]",
  symbol: "text-[2.5rem]",
  name: "text-[1.25rem]",
  price: "text-[2.25rem]",
  change: "text-[1.5rem]",
  gap: "mt-[0.5rem]",
};
const COMPACT_SIZE = {
  padding: "px-[1.75rem]",
  symbol: "text-[1.875rem]",
  name: "text-[1rem] leading-tight",
  price: "text-[1.75rem]",
  change: "text-[1.125rem] leading-tight",
  gap: "mt-[0.25rem]",
};

/** A five-point star in a 24×24 box, for favorites. */
export const STAR_PATH =
  "M12 2.5l2.94 6.1 6.56.83-4.82 4.56 1.25 6.51L12 17.27l-5.93 3.23 1.25-6.51-4.82-4.56 6.56-.83z";

function WatchlistTile({
  item,
  compact,
  favorite,
  selected,
}: {
  item: WatchlistItem;
  compact: boolean;
  favorite: boolean;
  selected: boolean;
}) {
  const up = item.change24h >= 0;
  const size = compact ? COMPACT_SIZE : FULL_SIZE;
  return (
    <div
      className={`relative flex h-full items-center justify-between rounded-[1.5rem] border border-panel-border bg-panel ${size.padding}`}
    >
      {selected && (
        <div
          aria-hidden
          className="absolute inset-y-[1.25rem] left-0 w-[0.375rem] rounded-r-full bg-highlight"
        />
      )}
      <div className="min-w-0">
        <div className={`flex items-center gap-[0.4em] ${size.symbol} font-semibold leading-none`}>
          {favorite && (
            // SVG rather than ★, which the TV's fonts may not have.
            <svg aria-label="Favorite" viewBox="0 0 24 24" className="h-[0.75em] w-[0.75em] shrink-0 fill-amber-400">
              <path d={STAR_PATH} />
            </svg>
          )}
          {item.symbol}
        </div>
        <div className={`${size.gap} truncate ${size.name} text-muted`}>{item.name}</div>
      </div>
      {/* A symbol just added from the phone has no price until its first
          quote arrives. */}
      <div className="shrink-0 pl-[1rem] text-right">
        <div className={`font-mono ${size.price} leading-none tabular-nums`}>
          {item.price > 0 ? formatPrice(item.price) : "—"}
        </div>
        <div
          className={`${size.gap} font-mono ${size.change} tabular-nums ${
            up ? "text-up" : "text-down"
          }`}
        >
          {item.price > 0 ? formatChange(item.change24h) : "\u00a0"}
        </div>
      </div>
    </div>
  );
}
