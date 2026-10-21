"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  layoutCandles,
  priceRange,
  priceTicks,
  tickDigits,
  timeTicks,
  type Candle,
} from "@/app/lib/candles";
import { formatPrice } from "@/app/lib/watchlist";

/** Least width reserved on the right for price labels, in rem. */
const AXIS_REM = 9;
/** Font sizes of the gridline labels and the live-price tag, in rem. */
const TICK_REM = 1.25;
const TAG_REM = 1.35;
/** Geist Mono is monospaced: every character is 0.6 em wide. */
const MONO_ADVANCE = 0.6;

// A candlestick chart drawn as plain SVG: no chart library, nothing to load on
// the TV, and every size in rem so it reads from across the room. The last
// candle tracks the live price, marked with a dashed line and a price tag.
export function CandleChart({
  symbol,
  candles,
  caption,
  slots,
}: {
  symbol: string;
  candles: Candle[] | undefined;
  caption: string;
  /** Room for at least this many candles (see layoutCandles). */
  slots?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number; rem: number }>();

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      setSize({ width: box.clientWidth, height: box.clientHeight, rem });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);


  return (
    <div ref={boxRef} className="relative min-h-0 flex-1">
      {!candles?.length ? (
        <div className="flex h-full items-center justify-center text-[1.5rem] text-muted">
          Loading chart…
        </div>
      ) : (
        size && (
          // Remount (and so fade in again) when the symbol or interval
          // changes, but not on a refresh: 1-minute data moves every minute.
          <Plot key={`${symbol}-${caption}`} candles={candles} size={size} caption={caption} slots={slots} />
        )
      )}
    </div>
  );
}

function Plot({
  candles,
  size,
  caption,
  slots,
}: {
  candles: Candle[];
  size: { width: number; height: number; rem: number };
  caption: string;
  slots?: number;
}) {
  const { rem } = size;
  const top = 2.5 * rem;
  // Room for the time labels under the candles.
  const bottom = 2.75 * rem;
  const { min, max } = priceRange(candles);
  const ticks = priceTicks(min, max, 4);
  const digits = tickDigits(ticks);
  const tagLabel = formatPrice(candles[candles.length - 1].c, digits);
  // The price axis grows to fit its longest label, so six-figure prices such
  // as $108,420.15 stay inside the panel. Labels start 1rem in, and the tag
  // keeps 0.5rem of padding on its right.
  const textRem = (label: string, fontRem: number) => label.length * MONO_ADVANCE * fontRem;
  const axisRem = Math.max(
    AXIS_REM,
    ...ticks.map((tick) => 1 + textRem(formatPrice(tick, digits), TICK_REM)),
    1.5 + textRem(tagLabel, TAG_REM),
  );
  const plotWidth = Math.max(size.width - axisRem * rem, 10);
  const plotHeight = Math.max(size.height - top - bottom, 10);
  const { shapes, y } = layoutCandles(candles, plotWidth, plotHeight, slots);
  const times = timeTicks(candles);
  const last = candles[candles.length - 1];
  const lastUp = last.c >= candles[0].o;
  const lastY = top + y(last.c);

  return (
    <svg
      width={size.width}
      height={size.height}
      className="chart-fade-in absolute inset-0"
      role="img"
      aria-label={`Price chart, ${caption}`}
    >
      <text x={0} y={1.25 * rem} fill="var(--muted)" fontSize={1.25 * rem}>
        {caption}
      </text>

      {ticks.map((tick) => {
        const ty = top + y(tick);
        return (
          <g key={tick}>
            <line x1={0} x2={plotWidth} y1={ty} y2={ty} stroke="var(--chart-grid)" strokeWidth={1} />
            <text
              x={plotWidth + 1 * rem}
              y={ty + 0.45 * rem}
              fill="var(--muted)"
              fontSize={TICK_REM * rem}
              fontFamily="var(--font-geist-mono)"
            >
              {formatPrice(tick, digits)}
            </text>
          </g>
        );
      })}

      {times.map(({ index, label }) => {
        const shape = shapes[index];
        const tx = shape.x + shape.width / 2;
        // Skip labels that would hang off either edge of the plot.
        if (tx < 1.5 * rem || tx > plotWidth - 1.5 * rem) return null;
        return (
          <text
            key={`${index}-${label}`}
            x={tx}
            y={top + plotHeight + 2 * rem}
            textAnchor="middle"
            fill="var(--muted)"
            fontSize={1.15 * rem}
            fontFamily="var(--font-geist-mono)"
          >
            {label}
          </text>
        );
      })}

      {/* Neon only: a soft halo behind each candle, drawn as wider, faint
          copies rather than a blur filter, which is costly on TV GPUs. Hidden
          (and not painted) in the other themes. */}
      <g className="candle-glow" transform={`translate(0, ${top})`}>
        {shapes.map((s, i) => {
          const color = s.up ? "var(--up)" : "var(--down)";
          const cx = s.x + s.width / 2;
          const pad = Math.max(s.width * 0.22, 0.12 * rem);
          return (
            <g key={candles[i].t} fill={color} stroke={color}>
              <line x1={cx} x2={cx} y1={s.wickTop} y2={s.wickBottom} strokeWidth={0.7 * rem} opacity={0.25} />
              <rect
                className="candle-body"
                x={s.x - pad}
                y={s.bodyTop - pad}
                width={s.width + 2 * pad}
                height={s.bodyHeight + 2 * pad}
                rx={pad}
                stroke="none"
                opacity={0.32}
              />
            </g>
          );
        })}
      </g>

      <g transform={`translate(0, ${top})`}>
        {shapes.map((s, i) => {
          const color = s.up ? "var(--up)" : "var(--down)";
          const cx = s.x + s.width / 2;
          return (
            <g key={candles[i].t}>
              <line x1={cx} x2={cx} y1={s.wickTop} y2={s.wickBottom} stroke={color} strokeWidth={Math.max(rem * 0.12, 1)} />
              <rect className="candle-body" x={s.x} y={s.bodyTop} width={s.width} height={s.bodyHeight} fill={color} rx={Math.min(s.width * 0.15, 2)} />
            </g>
          );
        })}
      </g>

      <line
        x1={0}
        x2={plotWidth}
        y1={lastY}
        y2={lastY}
        stroke={lastUp ? "var(--up)" : "var(--down)"}
        strokeWidth={1.5}
        strokeDasharray={`${0.5 * rem} ${0.4 * rem}`}
        opacity={0.8}
      />
      <rect
        x={plotWidth + 0.5 * rem}
        y={lastY - 1 * rem}
        width={(axisRem - 0.5) * rem}
        height={2 * rem}
        rx={0.4 * rem}
        fill={lastUp ? "var(--up)" : "var(--down)"}
      />
      <text
        x={plotWidth + 1 * rem}
        y={lastY + 0.5 * rem}
        fill="var(--price-tag-text)"
        fontSize={TAG_REM * rem}
        fontWeight={600}
        fontFamily="var(--font-geist-mono)"
      >
        {tagLabel}
      </text>
    </svg>
  );
}
