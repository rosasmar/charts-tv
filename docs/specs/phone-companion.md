# Spec: phone companion

*Spec written with Claude Code, for **Kiro Crew** to implement in this repo.*

## Goal

Let a viewer control TickerTV from their phone. The TV shows a QR code. Scanning it opens a page on the phone where the viewer **types or speaks** commands such as "show Solana", "pause" or "alert me if bitcoin drops 5 percent", and **the TV reacts within seconds**.

This adds touch and free-form voice to the existing D-pad, media-button and visual interactions. That combination of voice, D-pad and visuals in one flow is the multi-modal experience the Fire TV judges reward.

## Context: read before writing code

- `AGENTS.md`: the repo rules. One feature per PR, fill in the PR template, no personal information, and no AI-attribution trailers in commits.
- `web/AGENTS.md`: this is **Next.js 16 with Cache Components**. Read the bundled docs in `web/node_modules/next/dist/docs/` before writing routes. Route handlers that read the request run at request time. Never cache anything per-session.
- `web/app/components/dashboard.tsx`: owns TV state. `selectedIndex` and `focusedIndex`, `setRotationPaused(paused)`, `step(+1 | -1)`, `showBadge(icon, text)`, and the alert rules passed to `usePriceAlerts`. **Remote commands must go through these existing functions**, so behavior matches the D-pad and media buttons.
- `web/app/lib/alerts.ts`: `AlertRule` and `evaluateAlerts`. User alerts from the phone are additional `AlertRule`s.
- `web/app/lib/market.ts`: `WATCHLIST_SOURCES`, which gives each symbol's ticker and name, for example `BTC` / `Bitcoin`.
- The UI is sized in `rem`, where 1rem is 1/120 of the viewport width, with a pure black background. Colors come from the CSS variables in `globals.css`.

## User flow

1. On the TV, a small **QR code** sits in the header (top right, under the wordmark) with the text **"Scan to control"** and a short pairing code such as `K7P2QX`.
2. Scanning opens `https://<host>/remote/K7P2QX` on the phone: a mobile page with a text field, a **mic button**, **quick buttons** (◀◀ Prev, ⏯ Pause/Play, ▶▶ Next) and a list of example commands.
3. The viewer types or speaks a command, for example "show amazon".
4. The phone shows "Sent ✓". Within about 2 s the TV switches the chart to AMZN and shows the existing badge, like "▶▶ AMZN".
5. If the phone's command isn't understood, the **phone** shows "Didn't catch that. Try 'show bitcoin' or 'pause'", and nothing is sent.

## Requirements

**Pairing**
- R1. When the TV loads, it creates a random pairing code: 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, with no ambiguous characters. It keeps the code for the life of the page.
- R2. The TV renders a QR code for `<origin>/remote/<code>` as inline SVG, using the `qrcode` npm package (MIT), with no network call. It must be scannable from about 2 m off a 1080p TV, so roughly 9rem square, white on black with a quiet zone.

**Commands**
- R3. A **pure** function `parseCommand(text: string): RemoteCommand | null` in `web/app/lib/remote-commands.ts` turns free text, in any case and with filler words, into one of these:
  - `{ type: "select", symbol }`: "show / switch to / go to / open / chart" plus a ticker or name, e.g. "show me solana", "BTC", "amazon stock".
  - `{ type: "next" }` / `{ type: "previous" }`: "next", "previous", "back", "skip".
  - `{ type: "pause" }` / `{ type: "play" }`: "pause", "stop", "freeze" / "play", "resume", "start", "rotate".
  - `{ type: "alert", symbol, direction: "up" | "down", pct }`: e.g. "alert me if bitcoin drops 5 percent", "tell me when DOGE is up 10%". The percentage must be between 1 and 50.
  - It returns `null` for anything else.
- R4. Symbol matching uses `WATCHLIST_SOURCES` tickers and names, plus aliases ("bitcoin", "ether", "ethereum", "sol", "doge", "dogecoin", "ripple", "amazon"). Unknown symbols return `null`.
- R5. The phone parses commands before sending, and the server **validates again** with the same function. The server never trusts the client.

**Relay (phone → server → TV)**
- R6. `POST /api/remote/[code]/commands` with body `{ text: string }`:
  - `text` must be at most 200 characters, and the code must match R1's format. Otherwise the route returns 400.
  - Valid text is parsed and the `RemoteCommand` is stored with an increasing `id`, returning 201 `{ id, command }`.
  - Text that doesn't parse returns 422 `{ error: "not_understood" }`.
- R7. `GET /api/remote/[code]/commands?after=<id>` returns `{ commands: [{ id, command }] }` newer than `after`, at most 20.
- R8. Storage is **Upstash Redis** through the `@upstash/redis` client, using the env vars that the Vercel Marketplace integration adds (`KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`; support both).
  - One list per code, key `remote:<code>`, with **TTL 1 hour**, refreshed on every write, and trimmed to the last 50 commands.
  - Store no personal data, only parsed commands.
- R9. **If Redis isn't configured,** the routes return 503 `{ error: "remote_unavailable" }`, and the TV **hides** the QR block. Everything else keeps working. Local development and tests must work without Redis.
- R10. Rate limiting: at most 30 POSTs per code per minute, using a Redis counter with a 60 s TTL. Over the limit returns 429.

**TV integration**
- R11. A client hook `useRemoteCommands(code, onCommand)` polls R7, remembers the last `id`, and calls `onCommand` for each new command in order. Network errors are ignored and retried on the next tick.
  - **Polling is adaptive, to stay inside Upstash's free plan (500,000 commands a month):** it polls every **5 s** while idle, and switches to every **1 s** for **2 minutes** after any command arrives. A command therefore lands within about 5 s at first, then within about 1 s once the viewer is using the phone.
  - It doesn't poll while `document.visibilityState` is `"hidden"`.
- R12. In `dashboard.tsx`, remote commands map onto existing behavior:
  - `select` sets the selected and focused index to that symbol, holds rotation like an OK press, and shows the badge.
  - `next` / `previous` call `step(±1)`.
  - `pause` / `play` call `setRotationPaused(true | false)`.
  - `alert` adds an `AlertRule` (`kind: "move"`, `pct`) for that symbol to the rules passed to `usePriceAlerts`, and shows a badge with a bell icon and text such as "BTC ±5%". Draw the bell as SVG, like the existing badge icons, not as an emoji.
- R13. Remote commands must not break the D-pad: focus, selection and rotation stay consistent whichever input is used.

**Phone page**
- R14. `/remote/[code]` is a mobile-first page in the same dark style. It has:
  - a large text input with a **Send** button, which also sends on Enter
  - a **mic button** using the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). When it's unsupported, the button is hidden. The recognized text goes through `parseCommand` and is sent.
  - three quick buttons for Prev, Pause/Play and Next
  - three tappable examples: "show bitcoin", "pause", "alert me if amazon drops 3%"
  - a status line: "Sent ✓", "Didn't catch that…" or "TV not reachable — check the code".
- R15. The page needs no login. Anyone with the code can control that TV for an hour, which is acceptable for a living-room demo.

## Non-goals

- Accounts, persistence beyond 1 hour, or multiple TVs per phone.
- Sending commands from the TV to the phone.
- Using Bedrock or another LLM for parsing. The rules in R3 are enough and work offline.

## Tests (vitest, already set up: `npm test` in `web/`)

- `remote-commands.test.ts`:
  - every R3 example phrase, including case and filler words
  - all aliases
  - percentage bounds (0, 1, 50 and 51)
  - unknown symbols, empty strings and over-long input return `null`
- A pairing-code generator test: length, alphabet, and randomness across calls.
- Route-level logic should be pure and tested without Redis, for example a `validateRemoteRequest()` helper.

## Acceptance criteria

1. `npm run lint`, `npm test` and `npm run build` pass in `web/`.
2. Locally without Redis, the TV hides the QR block, and `/api/remote/*` returns 503.
3. On the production deployment with Redis:
   - Scanning the TV's QR code with a phone opens the remote.
   - "show solana" switches the TV within about 5 s, and later commands within about 1 s.
   - "pause" pauses rotation.
   - "alert me if bitcoin drops 5 percent" shows the bell badge with "BTC ±5%".
4. On the Vega Virtual Device, the QR code is visible and scannable from a phone pointed at the Mac screen, and commands from the phone reach the VVD app.
5. The D-pad and media buttons still work as before.

## Suggested tasks

1. `remote-commands.ts` + tests (R3, R4).
2. Pairing code + QR component (R1, R2), with the TV header placement.
3. Redis client wrapper, with the R9 fallback, plus the two routes and rate limiting (R6–R10).
4. `useRemoteCommands` + Dashboard wiring (R11–R13).
5. The phone page (R14).
6. README: a "Phone companion" feature row, and setup for the Upstash integration.
