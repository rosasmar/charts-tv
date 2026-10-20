import { describe, expect, it } from "vitest";
import { pixelShiftOffset } from "./pixel-shift";

describe("pixelShiftOffset", () => {
  it("starts centred", () => {
    expect(pixelShiftOffset(0)).toEqual({ xRem: 0, yRem: 0 });
  });

  it("visits 9 distinct positions per cycle, then repeats", () => {
    const cycle = Array.from({ length: 9 }, (_, i) => pixelShiftOffset(i));
    expect(new Set(cycle.map((o) => `${o.xRem},${o.yRem}`)).size).toBe(9);
    expect(pixelShiftOffset(9)).toEqual(pixelShiftOffset(0));
    expect(pixelShiftOffset(13)).toEqual(pixelShiftOffset(4));
  });

  it("never moves more than 0.375rem (6px at 1080p) on either axis", () => {
    for (let i = 0; i < 9; i++) {
      const { xRem, yRem } = pixelShiftOffset(i);
      expect(Math.abs(xRem)).toBeLessThanOrEqual(0.375);
      expect(Math.abs(yRem)).toBeLessThanOrEqual(0.375);
    }
  });

  it("handles negative steps", () => {
    expect(pixelShiftOffset(-1)).toEqual(pixelShiftOffset(8));
  });
});
