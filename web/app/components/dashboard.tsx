"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertBanner } from "@/app/components/alert-banner";
import { CandleChart } from "@/app/components/candle-chart";
import { Watchlist } from "@/app/components/watchlist";
import { WhatsMovingPanel } from "@/app/components/whats-moving";
import { useDpad } from "@/app/lib/dpad";
import { useMediaSession } from "@/app/lib/media-session";
import {
  DEFAULT_ALERT_RULES,
  alreadyTriggered,
  describeRule,
  type AlertRule,
} from "@/app/lib/alerts";
import { withLivePrice } from "@/app/lib/candles";
import { useCandles } from "@/app/lib/use-candles";
import { useDemoPrices } from "@/app/lib/use-demo-prices";
import { useLiveMarket } from "@/app/lib/use-live-market";
import { formatChange, formatPrice } from "@/app/lib/watchlist";
import { usePriceAlerts } from "@/app/lib/use-price-alerts";
import { useRemoteCommands } from "@/app/lib/use-remote-commands";
import { usePairing } from "@/app/lib/use-pairing-code";
import type { WatchlistItem } from "@/app/lib/watchlist";
import type { RemoteCommand } from "@/app/lib/remote-commands";

/** How long each symbol stays in the chart panel while auto-rotating. */
const ROTATE_MS = 10_000;
/** Remote use pauses rotation; it resumes after this much idle time. */
const RESUME_AFTER_MS = 30_000;
/** How long the on-screen badge for a media command stays up. */
const BADGE_MS = 1_500;

type BadgeIcon = "play" | "pause" | "next" | "previous";
type Badge = { icon: BadgeIcon; text: string; id: number };

// The chart panel and watchlist, driven by the remote. Focus lives in state
// (not DOM focus) so navigation is deterministic: Up/Down move the highlight
// through the watchlist, OK shows the focused symbol in the chart panel.
// Left alone, the panel rotates through the watchlist so the screen stays
// alive on an always-on TV; touching the remote pauses it. Media buttons and
// Alexa voice commands control it: Play/Pause stops or starts rotation, and
// fast-forward / rewind skip to the next or previous symbol.
export function Dashboard({
  items: sourceItems,
  remoteAvailable = false,
}: {
  items: WatchlistItem[];
  /** R9: hide QR block when Redis isn't configured. */
  remoteAvailable?: boolean;
}) {
  const liveItems = useLiveMarket(sourceItems);
  const { items, rules: demoRules } = useDemoPrices(liveItems);

  // R12 – remote-added alert rules accumulate here.
  const [remoteAlertRules, setRemoteAlertRules] = useState<AlertRule[]>([]);

  const alertRules = useMemo(
    () => [
      ...DEFAULT_ALERT_RULES,
      ...(demoRules.length ? demoRules : []),
      ...remoteAlertRules,
    ],
    [demoRules, remoteAlertRules],
  );
  const { alert, push: pushAlert } = usePriceAlerts(items, alertRules);
  const candles = useCandles();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const [badge, setBadge] = useState<Badge>();
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // R1: the page's pairing code, shared with the QR code in the header.
  const pairing = usePairing();

  // Any remote input holds rotation, and each press restarts the countdown.
  const holdRotation = () => {
    setHeld(true);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHeld(false), RESUME_AFTER_MS);
  };
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  useEffect(() => {
    if (!badge) return;
    const timer = setTimeout(() => setBadge(undefined), BADGE_MS);
    return () => clearTimeout(timer);
  }, [badge]);
  const showBadge = (icon: BadgeIcon, text: string) =>
    setBadge({ icon, text, id: Date.now() });

  const setRotationPaused = (next: boolean) => {
    setPaused(next);
    // An explicit play overrides any hold from recent D-pad use.
    if (!next) {
      clearTimeout(holdTimer.current);
      setHeld(false);
    }
    showBadge(next ? "pause" : "play", next ? "Paused" : "Auto-rotate");
  };

  const step = (delta: number) => {
    const next = (selectedIndex + delta + items.length) % items.length;
    setSelectedIndex(next);
    setFocusedIndex(next);
    showBadge(delta > 0 ? "next" : "previous", items[next]?.symbol ?? "");
  };

  const rotating = !paused && !held && items.length > 1;
  useEffect(() => {
    if (!rotating) return;
    const timer = setTimeout(() => {
      const next = (selectedIndex + 1) % items.length;
      setSelectedIndex(next);
      setFocusedIndex(next);
    }, ROTATE_MS);
    return () => clearTimeout(timer);
  }, [rotating, selectedIndex, items.length]);

  useDpad({
    up: () => {
      holdRotation();
      setFocusedIndex((i) => Math.max(0, i - 1));
    },
    down: () => {
      holdRotation();
      setFocusedIndex((i) => Math.min(items.length - 1, i + 1));
    },
    select: () => {
      holdRotation();
      setSelectedIndex(focusedIndex);
    },
    playPause: () => setRotationPaused(!paused),
    play: () => setRotationPaused(false),
    pause: () => setRotationPaused(true),
    next: () => step(1),
    previous: () => step(-1),
  });

  const selected = items[selectedIndex] ?? items[0];

  useMediaSession(
    {
      play: () => setRotationPaused(false),
      pause: () => setRotationPaused(true),
      next: () => step(1),
      previous: () => step(-1),
    },
    {
      playing: rotating,
      title: selected ? `${selected.symbol} · ${selected.name}` : "TickerTV",
    },
  );

  // R12 — handle remote commands.
  // A plain function, re-created each render so it always sees the current
  // selection and rotation state; useRemoteCommands keeps the latest one.
  const handleRemoteCommand = (cmd: RemoteCommand) => {
      switch (cmd.type) {
        case "select": {
          const idx = items.findIndex((it) => it.symbol === cmd.symbol);
          if (idx !== -1) {
            holdRotation();
            setSelectedIndex(idx);
            setFocusedIndex(idx);
            showBadge("next", cmd.symbol);
          }
          break;
        }
        case "next":
          step(1);
          break;
        case "previous":
          step(-1);
          break;
        case "pause":
          setRotationPaused(true);
          break;
        case "play":
          setRotationPaused(false);
          break;
        case "alert":
        case "priceAlert": {
          const item = items.find((it) => it.symbol === cmd.symbol);
          if (!item) break;
          const rule: AlertRule =
            cmd.type === "alert"
              ? { symbol: cmd.symbol, kind: "move", pct: cmd.pct, direction: cmd.direction }
              : {
                  symbol: cmd.symbol,
                  // "hits 83,700": above if that's higher than now, else below.
                  kind: (cmd.direction ?? (cmd.price > item.price ? "above" : "below")) === "above" ? "above" : "below",
                  price: cmd.price,
                };
          // Already past the line? Fire now; it would never cross again.
          const now = alreadyTriggered(rule, item);
          if (now) {
            pushAlert(now);
            break;
          }
          setRemoteAlertRules((prev) => [
            ...prev.filter((r) => JSON.stringify(r) !== JSON.stringify(rule)),
            rule,
          ]);
          pushAlert({
            id: `set-${Date.now()}`,
            symbol: cmd.symbol,
            direction: "info",
            title: describeRule(rule),
            detail: `Now ${formatPrice(item.price)} · ${formatChange(item.change24h)} today`,
          });
          break;
        }
      }
  };

  useRemoteCommands(
    remoteAvailable && pairing ? pairing.code : null,
    handleRemoteCommand,
  );

  // TODO: Give the chart panel its own focus zone (Left/Right to move between
  // zones, remembering the last focused tile) once the chart has controls
  // such as timeframes.

  return (
    <main className="grid min-h-0 grid-cols-[1fr_34rem] gap-[2rem]">
      <AlertBanner alert={alert} />
      <section
        aria-label="Chart"
        className="relative flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-panel-border bg-panel p-[2.5rem]"
      >
        <div className="flex items-start justify-between">
          {selected && (
            <div className="text-[3rem] font-semibold leading-none">
              {selected.symbol}
              <span className="ml-4 text-[2rem] font-normal text-muted">
                {selected.name}
              </span>
            </div>
          )}
          <div className="flex items-center gap-[2rem]">
            <div className="text-[1.25rem] text-muted">
              {rotating ? "Auto-rotating" : "Paused"}
            </div>
          </div>
        </div>
        <CandleChart
          candles={
            selected && candles[selected.symbol]
              ? withLivePrice(candles[selected.symbol], selected.price)
              : undefined
          }
          caption={selected?.symbol === "AMZN" ? "30-min candles · 5 days" : "30-min candles · 24 hours"}
        />
        <WhatsMovingPanel />
        {badge && (
          <div
            key={badge.id}
            role="status"
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[1.25rem] rounded-[1.5rem] border border-white/15 bg-black/85 px-[3rem] py-[1.5rem] text-[3.5rem] font-semibold tracking-tight"
          >
            <BadgeGlyph icon={badge.icon} />
            {badge.text}
          </div>
        )}
        {rotating && (
          <div
            // Restart the countdown bar each time the symbol changes.
            key={`${selectedIndex}-${held}`}
            aria-hidden
            className="rotate-progress absolute inset-x-0 bottom-0 h-[0.25rem] bg-white/40"
            style={{ animationDuration: `${ROTATE_MS}ms` }}
          />
        )}
      </section>

      <Watchlist
        items={items}
        focusedIndex={focusedIndex}
        selectedSymbol={selected?.symbol ?? ""}
      />
    </main>
  );
}

// Drawn as SVG rather than ▶ / ❚❚ characters, which the TV's fonts may not
// have (Geist renders ❚ as a box).
function BadgeGlyph({ icon }: { icon: BadgeIcon }) {
  const shapes: Record<BadgeIcon, React.ReactNode> = {
    play: <path d="M7 4l14 8-14 8z" />,
    pause: (
      <>
        <rect x="5" y="4" width="5" height="16" rx="1" />
        <rect x="14" y="4" width="5" height="16" rx="1" />
      </>
    ),
    next: (
      <>
        <path d="M2 5l10 7-10 7z" />
        <path d="M12 5l10 7-10 7z" />
      </>
    ),
    previous: (
      <>
        <path d="M22 5l-10 7 10 7z" />
        <path d="M12 5L2 12l10 7z" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-[3rem] w-[3rem]"
    >
      {shapes[icon]}
    </svg>
  );
}
