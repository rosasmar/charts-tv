"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { layoutCandles, priceTicks, type Candle } from "@/app/lib/candles";
import { formatPrice } from "@/app/lib/watchlist";

/** Width reserved on the right for price labels, in rem. */
const AXIS_REM = 9;

// A candlestick chart drawn as plain SVG: no chart library, nothing to load on
// the TV, and every size in rem so it reads from across the room. The last
// candle tracks the live price, marked with a dashed line and a price tag.
export function CandleChart({
  candles,
  caption,
}: {
  candles: Candle[] | undefined;
  caption: string;
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
          // Remount (and so fade in again) when the symbol's data changes.
          <Plot key={`${caption}-${candles[0].t}`} candles={candles} size={size} caption={caption} />
        )
      )}
    </div>
  );
}

function Plot({
  candles,
  size,
  caption,
}: {
  candles: Candle[];
  size: { width: number; height: number; rem: number };
  caption: string;
}) {
  const { rem } = size;
  const top = 2.5 * rem;
  const bottom = 1 * rem;
  const plotWidth = Math.max(size.width - AXIS_REM * rem, 10);
  const plotHeight = Math.max(size.height - top - bottom, 10);
  const { shapes, min, max, y } = layoutCandles(candles, plotWidth, plotHeight);
  const ticks = priceTicks(min, max, 4);
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
            <line x1={0} x2={plotWidth} y1={ty} y2={ty} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <text
              x={plotWidth + 1 * rem}
              y={ty + 0.45 * rem}
              fill="var(--muted)"
              fontSize={1.25 * rem}
              fontFamily="var(--font-geist-mono)"
            >
              {formatPrice(tick)}
            </text>
          </g>
        );
      })}

      <g transform={`translate(0, ${top})`}>
        {shapes.map((s, i) => {
          const color = s.up ? "var(--up)" : "var(--down)";
          const cx = s.x + s.width / 2;
          return (
            <g key={candles[i].t}>
              <line x1={cx} x2={cx} y1={s.wickTop} y2={s.wickBottom} stroke={color} strokeWidth={Math.max(rem * 0.12, 1)} />
              <rect x={s.x} y={s.bodyTop} width={s.width} height={s.bodyHeight} fill={color} rx={Math.min(s.width * 0.15, 2)} />
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
        width={AXIS_REM * rem - 0.5 * rem}
        height={2 * rem}
        rx={0.4 * rem}
        fill={lastUp ? "var(--up)" : "var(--down)"}
      />
      <text
        x={plotWidth + 1 * rem}
        y={lastY + 0.5 * rem}
        fill="#000"
        fontSize={1.35 * rem}
        fontWeight={600}
        fontFamily="var(--font-geist-mono)"
      >
        {formatPrice(last.c)}
      </text>
    </svg>
  );
}
