import { describe, expect, it } from "vitest";
import { validateRemoteRequest } from "./validate-remote";

describe("validateRemoteRequest", () => {
  it("returns 400 when code is missing", () => {
    const r = validateRemoteRequest(undefined, { text: "pause" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("returns 400 when code has wrong format", () => {
    // lowercase, too short, contains ambiguous char
    const r = validateRemoteRequest("abc123", { text: "pause" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("returns 400 when body is missing text", () => {
    const r = validateRemoteRequest("K7P2QX", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("returns 400 when text is empty", () => {
    const r = validateRemoteRequest("K7P2QX", { text: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("returns 400 when text exceeds 200 chars", () => {
    const r = validateRemoteRequest("K7P2QX", { text: "x".repeat(201) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("returns 422 when text doesn't parse to a command", () => {
    const r = validateRemoteRequest("K7P2QX", { text: "foobar junk unknown" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.error).toBe("not_understood");
    }
  });

  it("returns ok with command for valid input", () => {
    const r = validateRemoteRequest("K7P2QX", { text: "pause" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.code).toBe("K7P2QX");
      expect(r.command).toEqual({ type: "pause" });
    }
  });

  it("parses select command correctly", () => {
    const r = validateRemoteRequest("AB2345", { text: "show bitcoin" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.command).toEqual({ type: "select", symbol: "BTC" });
  });

  it("returns 400 when body is null", () => {
    const r = validateRemoteRequest("K7P2QX", null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("accepts text of exactly 200 chars that is a valid command", () => {
    const r = validateRemoteRequest("K7P2QX", { text: "pause" + " ".repeat(195) });
    expect(r.ok).toBe(true);
  });
});
