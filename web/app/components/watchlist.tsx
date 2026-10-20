import {
  formatChange,
  formatPrice,
  type WatchlistItem,
} from "@/app/lib/watchlist";

// Right-hand column of tiles, one per symbol, sized to read from 10 feet.
export function Watchlist({ items }: { items: WatchlistItem[] }) {
  return (
    <ul aria-label="Watchlist" className="flex min-h-0 flex-col gap-[1rem]">
      {items.map((item) => (
        <li key={item.symbol} className="flex-1">
          <WatchlistTile item={item} />
        </li>
      ))}
    </ul>
  );
}

function WatchlistTile({ item }: { item: WatchlistItem }) {
  const up = item.change24h >= 0;
  return (
    <div className="flex h-full items-center justify-between rounded-[1.5rem] border border-panel-border bg-panel px-[2rem]">
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
