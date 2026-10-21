import { describe, expect, it } from "vitest";
import { commandsAfter, parseStoredEntry } from "./remote-entries";

const pause = { type: "pause" };

describe("parseStoredEntry", () => {
  it("accepts objects, as returned by @upstash/redis auto-deserialization", () => {
    expect(parseStoredEntry({ id: 3, command: pause })).toEqual({ id: 3, command: pause });
  });

  it("accepts JSON strings", () => {
    expect(parseStoredEntry(JSON.stringify({ id: 4, command: pause }))).toEqual({ id: 4, command: pause });
  });

  it("drops malformed entries", () => {
    expect(parseStoredEntry("not json")).toBeNull();
    expect(parseStoredEntry({ id: 0, command: pause })).toBeNull();
    expect(parseStoredEntry({ id: 1.5, command: pause })).toBeNull();
    expect(parseStoredEntry({ id: 2, command: {} })).toBeNull();
    expect(parseStoredEntry({ id: 2 })).toBeNull();
    expect(parseStoredEntry(null)).toBeNull();
  });
});

describe("commandsAfter", () => {
  const entries = [
    { id: 1, command: pause },
    JSON.stringify({ id: 2, command: { type: "play" } }),
    "garbage",
    { id: 3, command: { type: "next" } },
  ];

  it("returns only newer entries, oldest first", () => {
    expect(commandsAfter(entries, 1).map((e) => e.id)).toEqual([2, 3]);
    expect(commandsAfter(entries, 3)).toEqual([]);
  });

  it("caps the result at the newest `limit` entries", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, command: pause }));
    const result = commandsAfter(many, 0, 20);
    expect(result).toHaveLength(20);
    expect(result[0].id).toBe(11);
    expect(result.at(-1)?.id).toBe(30);
  });
});
