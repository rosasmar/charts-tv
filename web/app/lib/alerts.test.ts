import { describe, expect, it } from "vitest";
import { evaluateAlerts, type AlertRule } from "./alerts";
import type { WatchlistItem } from "./watchlist";

const item = (symbol: string, price: number, change24h = 0): WatchlistItem => ({
  symbol,
  name: symbol,
  price,
  change24h,
});

describe("evaluateAlerts", () => {
  const above: AlertRule[] = [{ symbol: "AMZN", kind: "above", price: 230 }];
  const below: AlertRule[] = [{ symbol: "BTC", kind: "below", price: 100_000 }];
  const move: AlertRule[] = [{ symbol: "DOGE", kind: "move", pct: 5 }];

  it("fires nothing on first load", () => {
    expect(evaluateAlerts(undefined, [item("AMZN", 240)], above)).toEqual([]);
  });

  it("fires once when the price crosses above the level", () => {
    const alerts = evaluateAlerts([item("AMZN", 228.5)], [item("AMZN", 230.42, 2.6)], above);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ symbol: "AMZN", direction: "up" });
    expect(alerts[0].title).toBe("AMZN broke above $230.00");
    expect(alerts[0].detail).toBe("$230.42 · +2.60% today");
  });

  it("does not refire while the price stays above the level", () => {
    expect(evaluateAlerts([item("AMZN", 231)], [item("AMZN", 232)], above)).toEqual([]);
  });

  it("fires when the price lands exactly on the level", () => {
    expect(evaluateAlerts([item("AMZN", 229.99)], [item("AMZN", 230)], above)).toHaveLength(1);
  });

  it("fires when the price crosses below the level", () => {
    const alerts = evaluateAlerts([item("BTC", 100_500)], [item("BTC", 99_800)], below);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ symbol: "BTC", direction: "down" });
    expect(alerts[0].title).toBe("BTC fell below $100,000.00");
  });

  it("fires on a big move in either direction, once per crossing", () => {
    const down = evaluateAlerts([item("DOGE", 0.21, -3)], [item("DOGE", 0.2, -5.4)], move);
    expect(down).toHaveLength(1);
    expect(down[0]).toMatchObject({ direction: "down", title: "DOGE down 5.4% today" });

    const up = evaluateAlerts([item("DOGE", 0.21, 4.9)], [item("DOGE", 0.22, 6.1)], move);
    expect(up[0]).toMatchObject({ direction: "up", title: "DOGE up 6.1% today" });

    expect(evaluateAlerts([item("DOGE", 0.2, -5.4)], [item("DOGE", 0.19, -7)], move)).toEqual([]);
  });

  it("ignores symbols that are missing from either snapshot", () => {
    expect(evaluateAlerts([item("ETH", 1)], [item("AMZN", 300)], above)).toEqual([]);
  });
});

describe("demo plan through the alert engine", () => {
  it("fires an up alert for AMZN and a down alert for DOGE at live prices", async () => {
    const { buildDemoPlan } = await import("./use-demo-prices");
    const live = [
      { symbol: "AMZN", name: "Amazon", price: 262.63, change24h: 0.07 },
      { symbol: "DOGE", name: "Dogecoin", price: 0.081624, change24h: 3.4 },
    ];
    const plan = buildDemoPlan(live);
    expect(plan.rules).toEqual([
      { symbol: "AMZN", kind: "above", price: 265 },
      { symbol: "DOGE", kind: "below", price: 0.0792 },
    ]);
    const after = live.map((item) => {
      const step = plan.steps.find((s) => s.symbol === item.symbol)!;
      return { ...item, price: step.price, change24h: step.change24h };
    });
    const alerts = evaluateAlerts(live, after, plan.rules);
    expect(alerts.map((a) => [a.symbol, a.direction, a.title])).toEqual([
      ["AMZN", "up", "AMZN broke above $265.00"],
      ["DOGE", "down", "DOGE fell below $0.0792"],
    ]);
  });
});
