import { describe, expect, it } from "vitest";
import {
  layoutCandles,
  parseCoinGeckoOhlc,
  parseKrakenOhlc,
  parseYahooCandles,
  priceTicks,
  readCandlesFlag,
  tickDigits,
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

describe("parseKrakenOhlc", () => {
  it("reads string prices under Kraken's pair key, converts seconds to ms and skips bad rows", () => {
    const json = {
      error: [],
      result: {
        XXBTZUSD: [
          [1792600140, "84651.8", "84668.3", "84646.0", "84665.0", "84655.1", "0.52", 12],
          [1792600200, "84665.0", "", "84650.0", "84660.0", "84660.0", "0.10", 3],
          [1792600260, "84660.0", "84670.0"],
          [1792600320, "84660.0", "84675.5", "84655.0", "84670.2", "84664.0", "0.31", 7],
        ],
        last: 1792600260,
      },
    };
    expect(parseKrakenOhlc(json)).toEqual([
      { t: 1_792_600_140_000, o: 84_651.8, h: 84_668.3, l: 84_646, c: 84_665 },
      { t: 1_792_600_320_000, o: 84_660, h: 84_675.5, l: 84_655, c: 84_670.2 },
    ]);
  });

  it("returns nothing for an error payload", () => {
    expect(parseKrakenOhlc({ error: ["EQuery:Unknown asset pair"] })).toEqual([]);
    expect(parseKrakenOhlc(null)).toEqual([]);
  });
});

describe("readCandlesFlag", () => {
  it("reads ?candles=1m / 30m and ignores anything else", () => {
    expect(readCandlesFlag("?candles=1m")).toBe("1m");
    expect(readCandlesFlag("?demo=1&candles=30m")).toBe("30m");
    expect(readCandlesFlag("")).toBeUndefined();
    expect(readCandlesFlag("?candles=5m")).toBeUndefined();
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

describe("tickDigits", () => {
  it("gives the decimals that tell ticks apart", () => {
    // A 1-minute XRP chart: $0.002 steps need 3 decimals, $0.0025 steps 4.
    expect(tickDigits(priceTicks(1.3768, 1.3842))).toBe(3);
    expect(tickDigits([1.3775, 1.38, 1.3825])).toBe(4);
    expect(tickDigits([0.079, 0.08, 0.081])).toBe(3);
    expect(tickDigits([2_510, 2_512.5, 2_515])).toBe(1);
    expect(tickDigits([81_500, 82_000])).toBe(0);
  });

  it("is 0 without a step", () => {
    expect(tickDigits([5])).toBe(0);
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

  it("keeps the slot width for a short series when given more slots", () => {
    const candle = { t: 1, o: 10, h: 11, l: 9, c: 10.5 };
    const two = [candle, { ...candle, t: 2 }];
    // 60 slots in 600 px: 10 px apart, filling in from the left.
    const slotted = layoutCandles(two, 600, 100, 60).shapes;
    expect(slotted[1].x - slotted[0].x).toBeCloseTo(10);
    expect(slotted[0].x).toBeLessThan(10);
    // Without slots, two candles share the whole width.
    const shared = layoutCandles(two, 600, 100).shapes;
    expect(shared[1].x - shared[0].x).toBeCloseTo(300);
  });

  it("keeps a visible body for a doji (open = close)", () => {
    const { shapes } = layoutCandles([{ t: 1, o: 10, h: 11, l: 9, c: 10 }], 100, 100);
    expect(shapes[0].bodyHeight).toBeGreaterThanOrEqual(1);
  });
});
