import { describe, expect, it } from "vitest";
import { isNightTime, readDimSetting } from "./night-dim";

const at = (hour: number, minute = 0) => new Date(2026, 9, 21, hour, minute);

describe("isNightTime", () => {
  it("dims from 22:00 until 07:00", () => {
    expect(isNightTime(at(21, 59))).toBe(false);
    expect(isNightTime(at(22, 0))).toBe(true);
    expect(isNightTime(at(0, 30))).toBe(true);
    expect(isNightTime(at(6, 59))).toBe(true);
    expect(isNightTime(at(7, 0))).toBe(false);
    expect(isNightTime(at(12, 0))).toBe(false);
  });

  it("supports a window that doesn't wrap past midnight", () => {
    expect(isNightTime(at(14), 13, 15)).toBe(true);
    expect(isNightTime(at(15), 13, 15)).toBe(false);
  });
});

describe("readDimSetting", () => {
  it("reads on/off overrides and defaults to auto", () => {
    expect(readDimSetting("?dim=on")).toBe("on");
    expect(readDimSetting("?demo=1&dim=off")).toBe("off");
    expect(readDimSetting("")).toBe("auto");
    expect(readDimSetting("?dim=maybe")).toBe("auto");
  });
});
