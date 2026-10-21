import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
  parseThemeSetting,
  readThemeOverride,
  resolveTheme,
} from "./theme";

const at = (hour: number, minute = 0) => new Date(2026, 9, 21, hour, minute);

describe("readThemeOverride", () => {
  it("reads ?theme= and ignores anything else", () => {
    expect(readThemeOverride("?theme=light")).toBe("light");
    expect(readThemeOverride("?demo=1&theme=auto")).toBe("auto");
    expect(readThemeOverride("?theme=dark")).toBe("dark");
    expect(readThemeOverride("?theme=sepia")).toBeNull();
    expect(readThemeOverride("")).toBeNull();
  });
});

describe("parseThemeSetting", () => {
  it("accepts only the three settings", () => {
    expect(parseThemeSetting("light")).toBe("light");
    expect(parseThemeSetting(null)).toBeNull();
    expect(parseThemeSetting("Light")).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("keeps dark and light as they are", () => {
    expect(resolveTheme("dark", at(12))).toBe("dark");
    expect(resolveTheme("light", at(23))).toBe("light");
  });

  it("auto is light by day and dark from 22:00 to 07:00", () => {
    expect(resolveTheme("auto", at(6, 59))).toBe("dark");
    expect(resolveTheme("auto", at(7))).toBe("light");
    expect(resolveTheme("auto", at(21, 59))).toBe("light");
    expect(resolveTheme("auto", at(22))).toBe("dark");
  });
});

// Runs the inline script against stand-ins for the browser globals and
// returns the data-theme it set, if any.
function runScript(search: string, saved: string | null | Error, now: Date) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const document = { documentElement: { dataset: {} as Record<string, string> } };
  const localStorage = {
    getItem: (key: string) => {
      if (saved instanceof Error) throw saved;
      return key === THEME_STORAGE_KEY ? saved : null;
    },
  };
  new Function("location", "localStorage", "document", THEME_SCRIPT)(
    { search },
    localStorage,
    document,
  );
  return document.documentElement.dataset.theme;
}

describe("THEME_SCRIPT", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies the saved theme", () => {
    expect(runScript("", "light", at(12))).toBe("light");
    expect(runScript("", "dark", at(12))).toBe("dark");
    expect(runScript("", null, at(12))).toBeUndefined();
  });

  it("lets ?theme= override the saved theme", () => {
    expect(runScript("?theme=dark", "light", at(12))).toBe("dark");
    expect(runScript("?theme=nope", "light", at(12))).toBe("light");
  });

  it("resolves auto like resolveTheme", () => {
    for (const hour of [0, 6, 7, 12, 21, 22, 23]) {
      expect(runScript("?theme=auto", null, at(hour))).toBe(resolveTheme("auto", at(hour)));
    }
  });

  it("does nothing when storage is blocked", () => {
    expect(runScript("", new Error("SecurityError"), at(12))).toBeUndefined();
  });
});
