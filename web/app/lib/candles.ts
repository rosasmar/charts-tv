export type Candle = {
  /** Candle open time, epoch ms. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// CoinGecko /coins/{id}/ohlc → [[timeMs, open, high, low, close], …]
export function parseCoinGeckoOhlc(json: unknown): Candle[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((row) => {
    if (!Array.isArray(row) || row.length < 5 || !row.every(finite)) return [];
    const [t, o, h, l, c] = row as number[];
    return [{ t, o, h, l, c }];
  });
}

// Yahoo /v8/finance/chart → parallel arrays; gaps (nulls) are dropped.
export function parseYahooCandles(json: unknown): Candle[] {
  const result = (json as {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: { quote?: { open?: unknown[]; high?: unknown[]; low?: unknown[]; close?: unknown[] }[] };
      }[];
    };
  })?.chart?.result?.[0];
  const times = result?.timestamp;
  const q = result?.indicators?.quote?.[0];
  if (!times || !q) return [];
  return times.flatMap((seconds, i) => {
    const [o, h, l, c] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]];
    return finite(o) && finite(h) && finite(l) && finite(c) ? [{ t: seconds * 1000, o, h, l, c }] : [];
  });
}

// Folds the live price into the latest candle, so the chart's last close
// always matches the price shown on the watchlist tile.
export function withLivePrice(candles: Candle[], price: number): Candle[] {
  if (!candles.length || !(price > 0)) return candles;
  const last = candles[candles.length - 1];
  return [
    ...candles.slice(0, -1),
    { ...last, c: price, h: Math.max(last.h, price), l: Math.min(last.l, price) },
  ];
}

// Round-number price levels for gridlines, e.g. 81,000 / 82,000 / 83,000.
export function priceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  // Of the round steps near `raw`, use the one whose tick count is closest to
  // `count`.
  const candidates = [0.5, 1, 2, 2.5, 5, 10].map((m) => m * magnitude);
  const ticksFor = (s: number) => Math.floor(max / s) - Math.ceil(min / s) + 1;
  const step = candidates.reduce((best, s) =>
    Math.abs(ticksFor(s) - count) < Math.abs(ticksFor(best) - count) ? s : best,
  );
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }
  return ticks;
}

export type CandleShape = {
  x: number;
  width: number;
  wickTop: number;
  wickBottom: number;
  bodyTop: number;
  bodyHeight: number;
  up: boolean;
};

// Lays candles out in a width×height box (y grows downward, like SVG), with a
// little headroom so the highs and lows don't touch the edges.
export function layoutCandles(
  candles: Candle[],
  width: number,
  height: number,
): { shapes: CandleShape[]; min: number; max: number; y: (price: number) => number } {
  const lows = candles.map((c) => c.l);
  const highs = candles.map((c) => c.h);
  const lo = Math.min(...lows);
  const hi = Math.max(...highs);
  const pad = (hi - lo || hi * 0.01 || 1) * 0.08;
  const min = lo - pad;
  const max = hi + pad;
  const y = (price: number) => ((max - price) / (max - min)) * height;
  const slot = width / Math.max(candles.length, 1);
  const bodyWidth = Math.max(slot * 0.62, 1);

  const shapes = candles.map((candle, i) => {
    const top = y(Math.max(candle.o, candle.c));
    const bottom = y(Math.min(candle.o, candle.c));
    return {
      x: i * slot + (slot - bodyWidth) / 2,
      width: bodyWidth,
      wickTop: y(candle.h),
      wickBottom: y(candle.l),
      bodyTop: top,
      bodyHeight: Math.max(bottom - top, 1),
      up: candle.c >= candle.o,
    };
  });
  return { shapes, min, max, y };
}
