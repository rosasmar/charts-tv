import { describe, expect, it } from "vitest";
import { parseCommand } from "./remote-commands";

// ---- select ----------------------------------------------------------------

describe("parseCommand – select", () => {
  it("show bitcoin → select BTC", () => {
    expect(parseCommand("show bitcoin")).toEqual({ type: "select", symbol: "BTC" });
  });

  it("case insensitive", () => {
    expect(parseCommand("SHOW BITCOIN")).toEqual({ type: "select", symbol: "BTC" });
  });

  it("filler words ignored", () => {
    expect(parseCommand("show me solana please")).toEqual({ type: "select", symbol: "SOL" });
  });

  it("switch to ethereum", () => {
    expect(parseCommand("switch to ethereum")).toEqual({ type: "select", symbol: "ETH" });
  });

  it("go to ether", () => {
    expect(parseCommand("go to ether")).toEqual({ type: "select", symbol: "ETH" });
  });

  it("open DOGE", () => {
    expect(parseCommand("open DOGE")).toEqual({ type: "select", symbol: "DOGE" });
  });

  it("chart amazon", () => {
    expect(parseCommand("chart amazon")).toEqual({ type: "select", symbol: "AMZN" });
  });

  it("amazon stock", () => {
    expect(parseCommand("amazon stock")).toEqual({ type: "select", symbol: "AMZN" });
  });

  it("bare ticker BTC", () => {
    expect(parseCommand("BTC")).toEqual({ type: "select", symbol: "BTC" });
  });

  it("bare name bitcoin", () => {
    expect(parseCommand("bitcoin")).toEqual({ type: "select", symbol: "BTC" });
  });

  it("show ripple → XRP alias", () => {
    expect(parseCommand("show ripple")).toEqual({ type: "select", symbol: "XRP" });
  });

  it("show dogecoin → DOGE alias", () => {
    expect(parseCommand("show dogecoin")).toEqual({ type: "select", symbol: "DOGE" });
  });

  it("show hyperliquid → HYPE", () => {
    expect(parseCommand("show hyperliquid")).toEqual({ type: "select", symbol: "HYPE" });
  });

  it("bare ticker HYPE", () => {
    expect(parseCommand("HYPE")).toEqual({ type: "select", symbol: "HYPE" });
  });

  it("unknown symbol returns null", () => {
    expect(parseCommand("show foobar")).toBeNull();
  });
});

// ---- next / previous -------------------------------------------------------

describe("parseCommand – navigation", () => {
  it("next → next", () => {
    expect(parseCommand("next")).toEqual({ type: "next" });
  });

  it("skip → next", () => {
    expect(parseCommand("skip")).toEqual({ type: "next" });
  });

  it("previous → previous", () => {
    expect(parseCommand("previous")).toEqual({ type: "previous" });
  });

  it("back → previous", () => {
    expect(parseCommand("back")).toEqual({ type: "previous" });
  });

  it("prev → previous", () => {
    expect(parseCommand("prev")).toEqual({ type: "previous" });
  });
});

// ---- pause / play ----------------------------------------------------------

describe("parseCommand – pause/play", () => {
  it("pause → pause", () => {
    expect(parseCommand("pause")).toEqual({ type: "pause" });
  });

  it("stop → pause", () => {
    expect(parseCommand("stop")).toEqual({ type: "pause" });
  });

  it("freeze → pause", () => {
    expect(parseCommand("freeze")).toEqual({ type: "pause" });
  });

  it("play → play", () => {
    expect(parseCommand("play")).toEqual({ type: "play" });
  });

  it("resume → play", () => {
    expect(parseCommand("resume")).toEqual({ type: "play" });
  });

  it("start → play", () => {
    expect(parseCommand("start")).toEqual({ type: "play" });
  });

  it("rotate → play", () => {
    expect(parseCommand("rotate")).toEqual({ type: "play" });
  });
});

// ---- alerts ----------------------------------------------------------------

describe("parseCommand – alert", () => {
  it("alert me if bitcoin drops 5 percent", () => {
    expect(parseCommand("alert me if bitcoin drops 5 percent")).toEqual({
      type: "alert",
      symbol: "BTC",
      direction: "down",
      pct: 5,
    });
  });

  it("tell me when DOGE is up 10%", () => {
    expect(parseCommand("tell me when DOGE is up 10%")).toEqual({
      type: "alert",
      symbol: "DOGE",
      direction: "up",
      pct: 10,
    });
  });

  it("alert me if amazon drops 3%", () => {
    expect(parseCommand("alert me if amazon drops 3%")).toEqual({
      type: "alert",
      symbol: "AMZN",
      direction: "down",
      pct: 3,
    });
  });

  it("pct = 1 (lower bound) is valid", () => {
    const result = parseCommand("alert me if BTC drops 1%");
    expect(result).toMatchObject({ type: "alert", pct: 1 });
  });

  it("pct = 50 (upper bound) is valid", () => {
    const result = parseCommand("alert me if ETH drops 50%");
    expect(result).toMatchObject({ type: "alert", pct: 50 });
  });

  it("pct = 0 is invalid → null", () => {
    expect(parseCommand("alert me if BTC drops 0%")).toBeNull();
  });

  it("pct = 51 is invalid → null", () => {
    expect(parseCommand("alert me if BTC drops 51%")).toBeNull();
  });

  it("unknown symbol returns null", () => {
    expect(parseCommand("alert me if SHIB drops 5%")).toBeNull();
  });
});

// ---- edge cases ------------------------------------------------------------

describe("parseCommand – edge cases", () => {
  it("empty string returns null", () => {
    expect(parseCommand("")).toBeNull();
  });

  it("over-long input (>200 chars) returns null", () => {
    expect(parseCommand("x".repeat(201))).toBeNull();
  });

  it("gibberish returns null", () => {
    expect(parseCommand("asdfqwerty junk")).toBeNull();
  });

  it("exactly 200 chars is parsed", () => {
    // A valid command padded to 200 chars with trailing spaces.
    const cmd = "pause" + " ".repeat(195);
    expect(parseCommand(cmd)?.type).toBe("pause");
  });
});

describe("parseCommand – price-level alerts", () => {
  it("reads 'hits' with no direction, so the TV decides", () => {
    expect(parseCommand("alert me if btc hits 83700")).toEqual({
      type: "priceAlert",
      symbol: "BTC",
      price: 83_700,
      direction: undefined,
    });
  });

  it("reads $, thousands separators and k", () => {
    expect(parseCommand("tell me when bitcoin reaches $83,700")).toMatchObject({ price: 83_700 });
    expect(parseCommand("alert me if btc goes above 84k")).toMatchObject({
      type: "priceAlert",
      price: 84_000,
      direction: "above",
    });
  });

  it("reads below/under and falling verbs as a level below", () => {
    expect(parseCommand("alert me if bitcoin falls below 80,000")).toMatchObject({
      type: "priceAlert",
      price: 80_000,
      direction: "below",
    });
    expect(parseCommand("notify me when amazon drops to 250")).toMatchObject({
      type: "priceAlert",
      symbol: "AMZN",
      price: 250,
      direction: "below",
    });
  });

  it("handles small prices", () => {
    expect(parseCommand("alert me if doge hits 0.08")).toMatchObject({ type: "priceAlert", price: 0.08 });
  });

  it("isn't mistaken for navigation", () => {
    expect(parseCommand("alert me if solana falls back to 100")).toMatchObject({
      type: "priceAlert",
      symbol: "SOL",
      price: 100,
    });
  });
});

describe("parseCommand – candle interval", () => {
  it.each([
    "1 minute candles",
    "one minute candles",
    "1m candles",
    "1m",
    "1-min candles",
    "One-minute chart",
    "switch to 1 minute candles",
    "show me 1m candles please",
  ])("%s → 1m", (text) => {
    expect(parseCommand(text)).toEqual({ type: "candles", interval: "1m" });
  });

  it.each([
    "30 minute candles",
    "thirty minute candles",
    "30m candles",
    "30m",
    "30-minute candlesticks",
    "go back to 30 minute candles",
  ])("%s → 30m", (text) => {
    expect(parseCommand(text)).toEqual({ type: "candles", interval: "30m" });
  });

  it("leaves alerts, navigation and select alone", () => {
    expect(parseCommand("alert me if bitcoin drops 5 percent")).toMatchObject({ type: "alert", pct: 5 });
    expect(parseCommand("alert me if bitcoin drops 1 percent")).toMatchObject({ type: "alert", pct: 1 });
    expect(parseCommand("alert me if amazon drops 30")).toMatchObject({ type: "alert", pct: 30 });
    expect(parseCommand("alert me if btc hits 83700")).toMatchObject({ type: "priceAlert" });
    expect(parseCommand("pause for 1 minute")).toEqual({ type: "pause" });
    expect(parseCommand("show bitcoin")).toEqual({ type: "select", symbol: "BTC" });
  });

  it("needs a size", () => {
    expect(parseCommand("candles")).toBeNull();
    expect(parseCommand("5 minute candles")).toBeNull();
  });
});

describe("parseCommand – alert without a direction", () => {
  it("fires either way", () => {
    expect(parseCommand("alert amazon 3%")).toEqual({ type: "alert", symbol: "AMZN", direction: undefined, pct: 3 });
  });

  it("still treats a bare small number after a move verb as a percentage", () => {
    expect(parseCommand("alert me if bitcoin drops 5")).toMatchObject({ type: "alert", pct: 5, direction: "down" });
  });
});

describe("parseCommand – theme", () => {
  it("light mode / day mode → light", () => {
    expect(parseCommand("light mode")).toEqual({ type: "theme", theme: "light" });
    expect(parseCommand("Day mode")).toEqual({ type: "theme", theme: "light" });
    expect(parseCommand("light theme please")).toEqual({ type: "theme", theme: "light" });
  });

  it("dark mode / night mode → dark", () => {
    expect(parseCommand("dark mode")).toEqual({ type: "theme", theme: "dark" });
    expect(parseCommand("night mode")).toEqual({ type: "theme", theme: "dark" });
  });

  it("auto mode / auto theme → auto", () => {
    expect(parseCommand("auto mode")).toEqual({ type: "theme", theme: "auto" });
    expect(parseCommand("auto theme")).toEqual({ type: "theme", theme: "auto" });
    expect(parseCommand("automatic theme")).toEqual({ type: "theme", theme: "auto" });
  });

  it("isn't mistaken for play or select", () => {
    expect(parseCommand("start dark mode")).toEqual({ type: "theme", theme: "dark" });
    expect(parseCommand("switch to light mode")).toEqual({ type: "theme", theme: "light" });
    expect(parseCommand("turn on day mode")).toEqual({ type: "theme", theme: "light" });
  });

  it("turning a theme off picks the other one", () => {
    expect(parseCommand("turn off dark mode")).toEqual({ type: "theme", theme: "light" });
    expect(parseCommand("disable light mode")).toEqual({ type: "theme", theme: "dark" });
    expect(parseCommand("turn auto mode off")).toBeNull();
  });

  it("leaves other commands alone", () => {
    expect(parseCommand("stop")).toEqual({ type: "pause" });
    expect(parseCommand("start")).toEqual({ type: "play" });
    expect(parseCommand("show bitcoin")).toEqual({ type: "select", symbol: "BTC" });
    expect(parseCommand("dark")).toBeNull();
  });
});

// ---- background ---------------------------------------------------------------

describe("parseCommand – background", () => {
  it("background opacity 40% → backgroundOpacity 40", () => {
    expect(parseCommand("background opacity 40%")).toEqual({ type: "backgroundOpacity", pct: 40 });
  });

  it("works without the % sign, with 'percent' and with filler words", () => {
    expect(parseCommand("background opacity 40")).toEqual({ type: "backgroundOpacity", pct: 40 });
    expect(parseCommand("Set the background opacity to 75 percent please")).toEqual({
      type: "backgroundOpacity",
      pct: 75,
    });
  });

  it("accepts 0 and 100, rounds decimals", () => {
    expect(parseCommand("background opacity 0%")).toEqual({ type: "backgroundOpacity", pct: 0 });
    expect(parseCommand("background opacity 100%")).toEqual({ type: "backgroundOpacity", pct: 100 });
    expect(parseCommand("background opacity 40.6")).toEqual({ type: "backgroundOpacity", pct: 41 });
  });

  it("rejects out-of-range or missing values", () => {
    expect(parseCommand("background opacity 101%")).toBeNull();
    expect(parseCommand("background opacity -10")).toBeNull();
    expect(parseCommand("background opacity")).toBeNull();
  });

  it("remove / clear background → clearBackground", () => {
    expect(parseCommand("remove background")).toEqual({ type: "clearBackground" });
    expect(parseCommand("Clear the background")).toEqual({ type: "clearBackground" });
    expect(parseCommand("delete background")).toEqual({ type: "clearBackground" });
  });

  it("never falls through to other commands", () => {
    // "stop" would be pause, "show" a select, and "back" previous.
    expect(parseCommand("stop background")).toBeNull();
    expect(parseCommand("show background")).toBeNull();
    expect(parseCommand("background")).toBeNull();
  });

  it("can't produce the upload notice from text", () => {
    expect(parseCommand("background photo")).toBeNull();
  });

  it("leaves the existing commands alone", () => {
    expect(parseCommand("back")).toEqual({ type: "previous" });
    expect(parseCommand("stop")).toEqual({ type: "pause" });
    expect(parseCommand("start")).toEqual({ type: "play" });
    expect(parseCommand("clear")).toBeNull();
    expect(parseCommand("alert me if bitcoin drops 5 percent")).toMatchObject({ type: "alert", pct: 5 });
  });
});

// ---- watchlist ---------------------------------------------------------------

describe("parseCommand – watchlist", () => {
  it("reads the list in order", () => {
    expect(parseCommand("watchlist AMZN NVDA BTC")).toEqual({
      type: "watchlist",
      symbols: ["AMZN", "NVDA", "BTC"],
      favorites: [],
    });
  });

  it("accepts commas, lowercase, names and aliases, and drops repeats", () => {
    expect(parseCommand("Watchlist: nvda, bitcoin,ethereum  NVDA")).toEqual({
      type: "watchlist",
      symbols: ["NVDA", "BTC", "ETH"],
      favorites: [],
    });
  });

  it("keeps tickers that are also filler words", () => {
    expect(parseCommand("watchlist A IT ME")).toMatchObject({ symbols: ["A", "IT", "ME"] });
  });

  it("accepts index, class-share, coin-pair and future tickers", () => {
    expect(parseCommand("watchlist ^GSPC BRK-B ADA-USD GC=F")).toMatchObject({
      symbols: ["^GSPC", "BRK-B", "ADA-USD", "GC=F"],
    });
  });

  it("rejects an empty list, more than 10 symbols, or a word that isn't a ticker", () => {
    expect(parseCommand("watchlist")).toBeNull();
    expect(parseCommand(`watchlist ${Array.from({ length: 11 }, (_, i) => `S${i}`).join(" ")}`)).toBeNull();
    expect(parseCommand("watchlist AMZN not!a!ticker")).toBeNull();
  });

  it("reads * as a favorite", () => {
    expect(parseCommand("watchlist *BTC AMZN *hype NVDA *BTC")).toEqual({
      type: "watchlist",
      symbols: ["BTC", "AMZN", "HYPE", "NVDA"],
      favorites: ["BTC", "HYPE"],
    });
    expect(parseCommand("watchlist *")).toBeNull();
  });

  it("isn't confused by tickers that are command words", () => {
    expect(parseCommand("watchlist STOP NEXT")).toMatchObject({ type: "watchlist", symbols: ["STOP", "NEXT"] });
  });
});

// ---- favorites ---------------------------------------------------------------

describe("parseCommand – favorite", () => {
  it.each([
    ["favorite bitcoin", "BTC"],
    ["favourite solana", "SOL"],
    ["star ETH", "ETH"],
    ["pin dogecoin", "DOGE"],
    ["add amazon to favorites", "AMZN"],
  ])("%s → pin %s", (text, symbol) => {
    expect(parseCommand(text)).toEqual({ type: "favorite", symbol, on: true });
  });

  it.each([
    ["unfavorite bitcoin", "BTC"],
    ["unstar eth", "ETH"],
    ["unpin hype", "HYPE"],
    ["remove xrp from favorites", "XRP"],
  ])("%s → unpin %s", (text, symbol) => {
    expect(parseCommand(text)).toEqual({ type: "favorite", symbol, on: false });
  });

  it("needs a known symbol", () => {
    expect(parseCommand("favorite foobar")).toBeNull();
  });

  it("leaves start, ping alerts and plain selects alone", () => {
    expect(parseCommand("start")).toEqual({ type: "play" });
    expect(parseCommand("ping me if bitcoin drops 5%")).toMatchObject({ type: "alert" });
    expect(parseCommand("show bitcoin")).toEqual({ type: "select", symbol: "BTC" });
  });
});
