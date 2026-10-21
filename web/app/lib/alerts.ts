import { formatChange, formatPrice, type WatchlistItem } from "./watchlist";

export type AlertRule =
  /** Fires when the price crosses from below to at/above `price`. */
  | { symbol: string; kind: "above"; price: number }
  /** Fires when the price crosses from above to at/below `price`. */
  | { symbol: string; kind: "below"; price: number }
  /**
   * Fires when the 24h change crosses `pct` percent: only upward with
   * direction "up", only downward with "down", either way without one.
   */
  | { symbol: string; kind: "move"; pct: number; direction?: "up" | "down" };

export type PriceAlert = {
  id: string;
  symbol: string;
  /** "info" is a confirmation (e.g. "Alert set"), not a price move. */
  direction: "up" | "down" | "info";
  title: string;
  detail: string;
};

// Viewers can add their own rules from the phone companion (see Dashboard).
// Percentage moves work at any price level, unlike fixed price lines.
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { symbol: "AMZN", kind: "move", pct: 3 },
  { symbol: "BTC", kind: "move", pct: 5 },
  { symbol: "ETH", kind: "move", pct: 5 },
  { symbol: "SOL", kind: "move", pct: 8 },
  { symbol: "XRP", kind: "move", pct: 8 },
  { symbol: "DOGE", kind: "move", pct: 8 },
  { symbol: "HYPE", kind: "move", pct: 8 },
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
      const upCross =
        rule.direction !== "down" && was.change24h < rule.pct && now.change24h >= rule.pct;
      const downCross =
        rule.direction !== "up" && was.change24h > -rule.pct && now.change24h <= -rule.pct;
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

// When a viewer sets an alert that is already past its line (e.g. "tell me
// when XRP is up 3%" while it's up 4.9%), it would never cross again. Returns
// the alert to show right away in that case, or null if the rule is pending.
export function alreadyTriggered(rule: AlertRule, item: WatchlistItem): PriceAlert | null {
  const id = `${rule.symbol}-now-${Date.now()}`;
  const detail = `${formatPrice(item.price)} · ${formatChange(item.change24h)} today`;
  if (rule.kind === "above" && item.price >= rule.price) {
    return { id, symbol: item.symbol, direction: "up", title: `${item.symbol} is already above ${formatPrice(rule.price)}`, detail };
  }
  if (rule.kind === "below" && item.price <= rule.price) {
    return { id, symbol: item.symbol, direction: "down", title: `${item.symbol} is already below ${formatPrice(rule.price)}`, detail };
  }
  if (rule.kind === "move") {
    const up = rule.direction !== "down" && item.change24h >= rule.pct;
    const down = rule.direction !== "up" && item.change24h <= -rule.pct;
    if (up || down) {
      return {
        id,
        symbol: item.symbol,
        direction: up ? "up" : "down",
        title: `${item.symbol} is already ${up ? "up" : "down"} ${Math.abs(item.change24h).toFixed(1)}% today`,
        detail,
      };
    }
  }
  return null;
}

// Short human description of a rule, for the "Alert set" confirmation.
export function describeRule(rule: AlertRule): string {
  if (rule.kind === "above") return `${rule.symbol} rises above ${formatPrice(rule.price)}`;
  if (rule.kind === "below") return `${rule.symbol} falls below ${formatPrice(rule.price)}`;
  const verb = rule.direction === "up" ? "is up" : rule.direction === "down" ? "drops" : "moves";
  return `${rule.symbol} ${verb} ${rule.pct}% today`;
}
