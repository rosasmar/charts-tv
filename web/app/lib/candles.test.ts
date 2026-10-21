import { describe, expect, it } from "vitest";
import {
  layoutCandles,
  parseCoinGeckoOhlc,
  parseYahooCandles,
  priceTicks,
  withLivePrice,
  type Candle,
} from "./candles";

describe("parseCoinGeckoOhlc", () => {
  it("reads [time, o, h, l, c] rows and skips malformed ones", () => {
    expect(
      parseCoinGeckoOhlc([
        [1000, 1, 3, 0.5, 2],
        [2000, 2, "x", 1, 2],
        [3000, 2, 2.5],
      ]),
    ).toEqual([{ t: 1000, o: 1, h: 3, l: 0.5, c: 2 }]);
  });

  it("returns nothing for an error payload", () => {
    expect(parseCoinGeckoOhlc({ status: { error_code: 429 } })).toEqual([]);
  });
});

describe("parseYahooCandles", () => {
  it("zips the arrays, converts seconds to ms and drops gaps", () => {
    const json = {
      chart: {
        result: [
          {
            timestamp: [10, 20, 30],
            indicators: {
              quote: [{ open: [1, null, 3], high: [2, 2, 4], low: [0.5, 1, 2.5], close: [1.5, 1.8, 3.5] }],
            },
          },
        ],
      },
    };
    expect(parseYahooCandles(json)).toEqual([
      { t: 10_000, o: 1, h: 2, l: 0.5, c: 1.5 },
      { t: 30_000, o: 3, h: 4, l: 2.5, c: 3.5 },
    ]);
  });

  it("returns nothing for an error result", () => {
    expect(parseYahooCandles({ chart: { result: null } })).toEqual([]);
  });
});

describe("withLivePrice", () => {
  const candles: Candle[] = [
    { t: 1, o: 10, h: 12, l: 9, c: 11 },
    { t: 2, o: 11, h: 12, l: 10, c: 11.5 },
  ];

  it("moves the last close to the live price and stretches high/low", () => {
    expect(withLivePrice(candles, 13).at(-1)).toEqual({ t: 2, o: 11, h: 13, l: 10, c: 13 });
    expect(withLivePrice(candles, 9.5).at(-1)).toEqual({ t: 2, o: 11, h: 12, l: 9.5, c: 9.5 });
    expect(withLivePrice(candles, 13)[0]).toBe(candles[0]);
  });

  it("leaves the candles alone without a usable price", () => {
    expect(withLivePrice(candles, 0)).toBe(candles);
    expect(withLivePrice([], 5)).toEqual([]);
  });
});

describe("priceTicks", () => {
  it("picks round steps inside the range", () => {
    expect(priceTicks(81_200, 83_600)).toEqual([81_500, 82_000, 82_500, 83_000, 83_500]);
    expect(priceTicks(0.0781, 0.0829)).toEqual([0.079, 0.08, 0.081, 0.082]);
  });

  it("handles a flat range", () => {
    expect(priceTicks(5, 5)).toEqual([5]);
  });
});

describe("layoutCandles", () => {
  it("maps highs above lows and colors by direction", () => {
    const { shapes, y } = layoutCandles(
      [
        { t: 1, o: 10, h: 12, l: 9, c: 11 },
        { t: 2, o: 11, h: 11.5, l: 8, c: 8.5 },
      ],
      200,
      100,
    );
    expect(shapes).toHaveLength(2);
    expect(shapes[0].up).toBe(true);
    expect(shapes[1].up).toBe(false);
    expect(shapes[0].wickTop).toBeLessThan(shapes[0].wickBottom);
    expect(shapes[1].x).toBeGreaterThan(shapes[0].x);
    // Headroom: the overall high and low sit inside the box.
    expect(y(12)).toBeGreaterThan(0);
    expect(y(8)).toBeLessThan(100);
  });

  it("keeps a visible body for a doji (open = close)", () => {
    const { shapes } = layoutCandles([{ t: 1, o: 10, h: 11, l: 9, c: 10 }], 100, 100);
    expect(shapes[0].bodyHeight).toBeGreaterThanOrEqual(1);
  });
});
