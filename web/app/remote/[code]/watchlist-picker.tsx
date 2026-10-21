"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MAX_WATCHLIST, WATCHLIST_SOURCES } from "@/app/lib/market";
import type { SymbolMatch } from "@/app/lib/symbol-search";
import { pinFavorites } from "@/app/lib/watchlist";

type Pick = { symbol: string; name: string; favorite?: boolean };

const STORAGE_KEY = "chartstv:picks";
const DEFAULT_PICKS: Pick[] = WATCHLIST_SOURCES.map(({ symbol, name }) => ({ symbol, name }));
/** Wait this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 250;

// The phone's draft list, kept in localStorage so it survives a reload. The
// server renders the default list; the saved draft takes over on hydration.
let draft: Pick[] | undefined;
const listeners = new Set<() => void>();

function getDraft(): Pick[] {
  if (draft === undefined) {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      draft = Array.isArray(saved) && saved.length ? (saved as Pick[]) : DEFAULT_PICKS;
    } catch {
      draft = DEFAULT_PICKS;
    }
  }
  return draft;
}

function saveDraft(next: Pick[]) {
  draft = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The draft just won't survive a reload.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The phone's watchlist picker: search for stocks, ETFs, indexes and coins,
 * build a list of up to 10, star favorites (pinned to the top of the board)
 * and send it all to the TV as one "watchlist …" command, with favorites
 * marked "*". Commands only go phone → TV, so the phone can't read the TV's
 * list; it remembers its own draft and starts from that, or the default board.
 */
export function WatchlistPicker({ send }: { send: (text: string) => Promise<boolean> }) {
  const picks = useSyncExternalStore(subscribe, getDraft, () => DEFAULT_PICKS);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<SymbolMatch[]>([]);
  const results = query.trim() ? found : [];
  const [sent, setSent] = useState(false);

  // The draft is kept in the board's order, favorites first, so the phone
  // shows what the TV will.
  const update = (next: Pick[]) => {
    saveDraft(pinFavorites(next, next.filter((p) => p.favorite).map((p) => p.symbol)));
    setSent(false);
  };

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbols?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) setFound(((await res.json()) as { results: SymbolMatch[] }).results);
      } catch {
        // Aborted by the next keystroke, or offline; the list just stays.
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const full = picks.length >= MAX_WATCHLIST;
  const has = (symbol: string) => picks.some((p) => p.symbol === symbol);

  const add = (match: SymbolMatch) => {
    if (full || has(match.symbol)) return;
    update([...picks, { symbol: match.symbol, name: match.name }]);
    setQuery("");
  };
  const remove = (symbol: string) => update(picks.filter((p) => p.symbol !== symbol));
  const toggleFavorite = (symbol: string) =>
    update(picks.map((p) => (p.symbol === symbol ? { ...p, favorite: !p.favorite } : p)));
  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...picks];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    update(next);
  };

  return (
    <section style={styles.section} aria-label="Watchlist">
      <div style={styles.header}>
        <span style={styles.heading}>Watchlist</span>
        <span style={styles.count}>
          {picks.length}/{MAX_WATCHLIST}
        </span>
      </div>

      <input
        style={styles.search}
        type="search"
        placeholder={full ? "Remove one to add another" : "Add a stock or coin, e.g. nvidia"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={full}
        aria-label="Search stocks and coins"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {results.length > 0 && (
        <ul style={styles.list} aria-label="Search results">
          {results.map((match) => (
            <li key={match.symbol}>
              <button
                style={styles.resultBtn}
                onClick={() => add(match)}
                disabled={full || has(match.symbol)}
              >
                <span style={styles.symbol}>{match.symbol}</span>
                <span style={styles.name}>{match.name}</span>
                <span style={styles.kind}>{has(match.symbol) ? "Added" : match.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ol style={styles.list} aria-label="Your list">
        {picks.map((pick, index) => (
          <li key={pick.symbol} style={styles.pickRow}>
            <button
              style={{ ...styles.iconBtn, ...(pick.favorite ? styles.starOn : {}) }}
              onClick={() => toggleFavorite(pick.symbol)}
              aria-pressed={!!pick.favorite}
              aria-label={`Favorite ${pick.symbol}`}
            >
              {pick.favorite ? "★" : "☆"}
            </button>
            <span style={styles.symbol}>{pick.symbol}</span>
            <span style={styles.name}>{pick.name}</span>
            <button
              style={{ ...styles.iconBtn, opacity: index === 0 ? 0.3 : 1 }}
              onClick={() => moveUp(index)}
              disabled={index === 0}
              aria-label={`Move ${pick.symbol} up`}
            >
              ↑
            </button>
            <button
              style={{ ...styles.iconBtn, opacity: picks.length === 1 ? 0.3 : 1 }}
              onClick={() => remove(pick.symbol)}
              disabled={picks.length === 1}
              aria-label={`Remove ${pick.symbol}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ol>

      <div style={styles.actions}>
        <button
          style={styles.sendBtn}
          onClick={async () =>
            setSent(
              await send(
                `watchlist ${picks.map((p) => `${p.favorite ? "*" : ""}${p.symbol}`).join(" ")}`,
              ),
            )
          }
        >
          {sent ? "Sent ✓" : "Send to TV"}
        </button>
        <button style={styles.resetBtn} onClick={() => update(DEFAULT_PICKS)}>
          Reset
        </button>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    borderTop: "1px solid rgba(255,255,255,0.12)",
    paddingTop: "1.25rem",
    marginBottom: "1.5rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "0.75rem",
  },
  heading: {
    fontSize: "1.1rem",
    fontWeight: 700,
  },
  count: {
    fontSize: "0.9rem",
    color: "#8a8a8a",
  },
  search: {
    width: "100%",
    boxSizing: "border-box",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "0.75rem",
    color: "#f5f5f5",
    fontSize: "1rem",
    padding: "0.75rem 1rem",
    outline: "none",
    marginBottom: "0.5rem",
  },
  list: {
    listStyle: "none",
    margin: "0 0 0.75rem",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
  },
  resultBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "0.75rem",
    color: "#f5f5f5",
    cursor: "pointer",
    fontSize: "0.95rem",
    padding: "0.6rem 0.9rem",
    textAlign: "left",
    touchAction: "manipulation",
  },
  pickRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    background: "#0b0b0b",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "0.75rem",
    padding: "0.35rem 0.4rem",
    fontSize: "0.95rem",
  },
  symbol: {
    fontWeight: 600,
    minWidth: "4.5rem",
  },
  name: {
    flex: 1,
    minWidth: 0,
    color: "#a0a0a0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  kind: {
    fontSize: "0.8rem",
    color: "#8a8a8a",
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    color: "#a0a0a0",
    cursor: "pointer",
    fontSize: "1rem",
    width: "2.5rem",
    height: "2.5rem",
    flexShrink: 0,
    touchAction: "manipulation",
  },
  starOn: {
    color: "#fbbf24",
  },
  actions: {
    display: "flex",
    gap: "0.5rem",
  },
  sendBtn: {
    flex: 1,
    background: "#ffffff",
    border: "1px solid #ffffff",
    borderRadius: "0.75rem",
    color: "#000",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: 600,
    padding: "0.75rem 1rem",
    touchAction: "manipulation",
  },
  resetBtn: {
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "0.75rem",
    color: "#f5f5f5",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "0.75rem 1rem",
    touchAction: "manipulation",
  },
};
