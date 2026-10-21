import { describe, expect, it } from "vitest";
import { generatePairingCode, isValidCode } from "./pairing-code";

const ALPHABET = new Set("ABCDEFGHJKMNPQRSTUVWXYZ23456789");

describe("generatePairingCode", () => {
  it("produces a string of exactly 6 characters", () => {
    expect(generatePairingCode()).toHaveLength(6);
  });

  it("only uses characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 100; i++) {
      for (const ch of generatePairingCode()) {
        expect(ALPHABET.has(ch)).toBe(true);
      }
    }
  });

  it("does not include ambiguous characters O, 0, I, 1, L", () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePairingCode();
      expect(code).not.toMatch(/[O0I1L]/);
    }
  });

  it("produces different codes across calls (probabilistic)", () => {
    const codes = new Set(Array.from({ length: 50 }, generatePairingCode));
    // With 32^6 ≈ 1 billion possibilities, 50 codes should all be distinct.
    expect(codes.size).toBe(50);
  });
});

describe("isValidCode", () => {
  it("accepts a valid 6-char uppercase code", () => {
    expect(isValidCode("K7P2QX")).toBe(true);
  });

  it("rejects a code that is too short", () => {
    expect(isValidCode("ABC")).toBe(false);
  });

  it("rejects a code that is too long", () => {
    expect(isValidCode("ABCDEFG")).toBe(false);
  });

  it("rejects lowercase", () => {
    expect(isValidCode("k7p2qx")).toBe(false);
  });

  it("rejects ambiguous characters", () => {
    expect(isValidCode("O12345")).toBe(false);
    expect(isValidCode("I23456")).toBe(false);
    expect(isValidCode("012345")).toBe(false);
    expect(isValidCode("123456")).toBe(false);
    expect(isValidCode("L23456")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidCode("")).toBe(false);
  });

  it("accepts codes produced by generatePairingCode", () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidCode(generatePairingCode())).toBe(true);
    }
  });
});
