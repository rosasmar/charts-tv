"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AMAZON_NEWS_SOURCE, type Headline } from "@/app/lib/rss";

/** How often to pull fresh headlines (the route caches for ~10 minutes). */
const REFRESH_MS = 10 * 60_000;
/** Scroll speed in rem per second, so it reads the same on any screen size. */
const SPEED_REM_PER_S = 6;

// Bottom strip of headlines scrolling right-to-left in a seamless loop. The
// list is rendered twice and the track slides by exactly one copy, so the
// loop has no visible seam. Only a CSS transform animates, which stays smooth
// on low-end TV hardware. ?news=amazon shows only Amazon's own newsroom, e.g.
// for recordings that shouldn't show third-party publication names.
export function NewsTicker() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [failed, setFailed] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);
  const [durationS, setDurationS] = useState(60);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { headlines: Headline[] } = await res.json();
        if (cancelled) return;
        // Keep showing the last good list if a refresh comes back empty.
        const amazonOnly =
          new URLSearchParams(window.location.search).get("news") === "amazon";
        const shown = amazonOnly
          ? data.headlines.filter((h) => h.source === AMAZON_NEWS_SOURCE)
          : data.headlines;
        if (shown.length) setHeadlines(shown);
        setFailed(false);
      } catch (error) {
        console.error(`[news] failed to load headlines: ${error}`);
        if (!cancelled) setFailed(true);
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useLayoutEffect(() => {
    const copy = copyRef.current;
    if (!copy) return;
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    setDurationS(copy.offsetWidth / (SPEED_REM_PER_S * remPx));
  }, [headlines]);

  return (
    <footer
      aria-label="News"
      className="relative flex h-[4.5rem] items-center overflow-hidden rounded-[1.25rem] border border-panel-border bg-panel text-[1.75rem] [box-shadow:var(--panel-glow)]"
    >
      <div className="flex h-full shrink-0 items-center pl-[2rem] pr-[1.5rem] text-[1.25rem] font-semibold uppercase tracking-[0.2em] text-muted">
        News
      </div>
      {/* Clipped here rather than masked by an opaque label, so the strip
          can turn translucent over a background photo. */}
      <div className="min-w-0 flex-1 overflow-hidden">
        {headlines.length === 0 ? (
          <div className="text-muted">
            {failed ? "Headlines unavailable right now" : "Loading headlines…"}
          </div>
        ) : (
          <div
            className="ticker-track flex w-max whitespace-nowrap"
            style={{ animationDuration: `${durationS}s` }}
          >
            {[0, 1].map((copy) => (
              <div
                key={copy}
                ref={copy === 0 ? copyRef : undefined}
                aria-hidden={copy === 1}
                className="flex"
              >
                {headlines.map((headline) => (
                  <span key={headline.id} className="flex items-center">
                    <span className="mr-[0.75rem] text-[1.25rem] font-semibold uppercase tracking-wider text-muted">
                      {headline.source}
                    </span>
                    <span>{headline.title}</span>
                    <span aria-hidden className="mx-[2rem] text-muted">
                      •
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
