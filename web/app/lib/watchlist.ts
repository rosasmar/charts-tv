export type WatchlistItem = {
  symbol: string;
  name: string;
  price: number;
  /** 24h change in percent, e.g. -1.8 for -1.8%. */
  change24h: number;
};

// Fallback prices, used only when a live quote isn't available (e.g. the very
// first build without network). Live prices come from lib/market-data.ts.
export const MOCK_WATCHLIST: WatchlistItem[] = [
  { symbol: "AMZN", name: "Amazon", price: 228.5, change24h: 1.84 },
  { symbol: "BTC", name: "Bitcoin", price: 108_420.15, change24h: 2.41 },
  { symbol: "ETH", name: "Ethereum", price: 3_912.4, change24h: -1.18 },
  { symbol: "SOL", name: "Solana", price: 187.32, change24h: 5.67 },
  { symbol: "XRP", name: "XRP", price: 2.41, change24h: 0.32 },
  { symbol: "DOGE", name: "Dogecoin", price: 0.2134, change24h: -3.05 },
  { symbol: "HYPE", name: "Hyperliquid", price: 80.99, change24h: 1.27 },
];

// Favorites first, each group keeping its own order. Used for the board and
// for the phone's draft list, so both show the same order.
export function pinFavorites<T extends { symbol: string }>(items: T[], favorites: string[]): T[] {
  if (!favorites.length) return items;
  const pinned = new Set(favorites);
  return [
    ...items.filter((i) => pinned.has(i.symbol)),
    ...items.filter((i) => !pinned.has(i.symbol)),
  ];
}

export function formatPrice(price: number): string {
  const digits = price >= 1000 ? 2 : price >= 1 ? 2 : 4;
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatChange(change: number): string {
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}
