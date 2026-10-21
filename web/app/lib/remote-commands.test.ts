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
