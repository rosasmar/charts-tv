import { describe, expect, it } from "vitest";
import { buildWhatsMovingPrompt, summarizeFromPrices } from "./whats-moving";
import type { WatchlistItem } from "./watchlist";

const item = (symbol: string, change24h: number, price = 10): WatchlistItem => ({
  symbol,
  name: `${symbol} name`,
  price,
  change24h,
});

describe("summarizeFromPrices", () => {
  it("names the leader and the laggard", () => {
    const summary = summarizeFromPrices([item("BTC", 2.4), item("SOL", 5.7), item("DOGE", -3.1)]);
    expect(summary).toEqual({
      headline: "SOL leads, DOGE lags",
      points: ["SOL +5.70%", "DOGE -3.10%"],
      source: "prices",
    });
  });

  it("describes all-green and all-red boards", () => {
    expect(summarizeFromPrices([item("A", 1), item("B", 3)]).headline).toBe("B leads a green board");
    expect(summarizeFromPrices([item("A", -1), item("B", -4)]).headline).toBe(
      "B leads the board lower",
    );
  });

  it("calls small moves flat", () => {
    const summary = summarizeFromPrices([item("A", 0.2), item("B", -0.3)]);
    expect(summary.headline).toBe("A quiet board");
    expect(summary.points).toEqual(["A +0.20%", "B -0.30%"]);
  });

  it("handles an empty or single-item watchlist", () => {
    expect(summarizeFromPrices([]).headline).toBe("Waiting for prices");
    expect(summarizeFromPrices([item("A", 2)]).points).toHaveLength(1);
  });
});

describe("buildWhatsMovingPrompt", () => {
  it("lists the board and numbers the headlines", () => {
    const prompt = buildWhatsMovingPrompt(
      [item("AMZN", 1.84, 228.5)],
      [{ id: "x", title: "Amazon opens a store", source: "About Amazon", link: "", publishedAt: 0 }],
    );
    expect(prompt).toContain("AMZN (AMZN name): $228.50, +1.84% 24h");
    expect(prompt).toContain("1. [About Amazon] Amazon opens a store");
  });

  it("says when there are no headlines", () => {
    expect(buildWhatsMovingPrompt([item("A", 1)], [])).toContain("(no headlines available)");
  });
});
