import { formatChange, formatPrice, type WatchlistItem } from "./watchlist";

export type AlertRule =
  /** Fires when the price crosses from below to at/above `price`. */
  | { symbol: string; kind: "above"; price: number }
  /** Fires when the price crosses from above to at/below `price`. */
  | { symbol: string; kind: "below"; price: number }
  /** Fires when the 24h change crosses ±`pct` percent (either direction). */
  | { symbol: string; kind: "move"; pct: number };

export type PriceAlert = {
  id: string;
  symbol: string;
  direction: "up" | "down";
  title: string;
  detail: string;
};

// TODO: Let viewers set their own alerts (e.g. from the phone companion)
// instead of this fixed list.
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { symbol: "AMZN", kind: "above", price: 230 },
  { symbol: "AMZN", kind: "below", price: 220 },
  { symbol: "BTC", kind: "above", price: 110_000 },
  { symbol: "BTC", kind: "below", price: 100_000 },
  { symbol: "ETH", kind: "move", pct: 5 },
  { symbol: "SOL", kind: "move", pct: 8 },
  { symbol: "DOGE", kind: "move", pct: 5 },
];

// Compares two snapshots of the watchlist and returns the alerts whose
// thresholds were crossed between them. Comparing snapshots (rather than
// checking levels) means each alert fires once per crossing, not on every
// update while the price stays past the line. With no previous snapshot
// (first load) nothing fires.
export function evaluateAlerts(
  prev: WatchlistItem[] | undefined,
  next: WatchlistItem[],
  rules: AlertRule[],
): PriceAlert[] {
  if (!prev) return [];
  const before = new Map(prev.map((item) => [item.symbol, item]));
  const alerts: PriceAlert[] = [];

  for (const rule of rules) {
    const now = next.find((item) => item.symbol === rule.symbol);
    const was = before.get(rule.symbol);
    if (!now || !was) continue;

    if (rule.kind === "above" && was.price < rule.price && now.price >= rule.price) {
      alerts.push({
        id: `${rule.symbol}-above-${rule.price}-${now.price}`,
        symbol: now.symbol,
        direction: "up",
        title: `${now.symbol} broke above ${formatPrice(rule.price)}`,
        detail: `${formatPrice(now.price)} · ${formatChange(now.change24h)} today`,
      });
    } else if (rule.kind === "below" && was.price > rule.price && now.price <= rule.price) {
      alerts.push({
        id: `${rule.symbol}-below-${rule.price}-${now.price}`,
        symbol: now.symbol,
        direction: "down",
        title: `${now.symbol} fell below ${formatPrice(rule.price)}`,
        detail: `${formatPrice(now.price)} · ${formatChange(now.change24h)} today`,
      });
    } else if (rule.kind === "move") {
      const upCross = was.change24h < rule.pct && now.change24h >= rule.pct;
      const downCross = was.change24h > -rule.pct && now.change24h <= -rule.pct;
      if (upCross || downCross) {
        alerts.push({
          id: `${rule.symbol}-move-${rule.pct}-${now.change24h}`,
          symbol: now.symbol,
          direction: upCross ? "up" : "down",
          title: `${now.symbol} ${upCross ? "up" : "down"} ${Math.abs(now.change24h).toFixed(1)}% today`,
          detail: `${formatPrice(now.price)} · ${formatChange(now.change24h)}`,
        });
      }
    }
  }
  return alerts;
}
