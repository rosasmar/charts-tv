import { NIGHT_END_HOUR, NIGHT_START_HOUR, isNightTime } from "./night-dim";

/** The looks the screen can have; each is a data-theme value in globals.css. */
export const THEMES = ["dark", "light", "neon", "matcha"] as const;
export type Theme = (typeof THEMES)[number];

/** What the viewer picks on the phone; "auto" follows the night-dim hours. */
const THEME_SETTINGS = [...THEMES, "auto"] as const;
export type ThemeSetting = (typeof THEME_SETTINGS)[number];

/** Where the TV remembers the theme: the pairing code changes every load. */
export const THEME_STORAGE_KEY = "chartstv-theme";

/** On-screen badge text when the theme changes. */
export const THEME_LABELS: Record<ThemeSetting, string> = {
  dark: "Dark mode",
  light: "Light mode",
  auto: "Auto theme",
  neon: "Neon lights",
  matcha: "Matcha",
};

export function parseThemeSetting(value: unknown): ThemeSetting | null {
  return (THEME_SETTINGS as readonly unknown[]).includes(value) ? (value as ThemeSetting) : null;
}

// ?theme=light / dark / auto / neon / matcha override the saved theme (e.g. to
// show it in the demo).
export function readThemeOverride(search: string): ThemeSetting | null {
  return parseThemeSetting(new URLSearchParams(search).get("theme"));
}

// Auto is light by day and dark at night, on the same hours as night dim.
export function resolveTheme(setting: ThemeSetting, date: Date): Theme {
  if (setting === "auto") return isNightTime(date) ? "dark" : "light";
  return setting;
}

// The same steps as readThemeOverride, the saved value and resolveTheme, as an
// inline script that sets data-theme while the HTML is still parsing, so a
// saved light, neon or matcha theme doesn't flash dark until React hydrates.
// Kept in sync by theme.test.ts, which runs it.
const nightJoin = NIGHT_START_HOUR > NIGHT_END_HOUR ? "||" : "&&";
export const THEME_SCRIPT = `(function () {
  try {
    var s = new URLSearchParams(location.search).get("theme");
    if (${JSON.stringify(THEME_SETTINGS)}.indexOf(s) < 0) s = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (s === "auto") {
      var h = new Date().getHours();
      s = h >= ${NIGHT_START_HOUR} ${nightJoin} h < ${NIGHT_END_HOUR} ? "dark" : "light";
    }
    if (${JSON.stringify(THEMES)}.indexOf(s) >= 0) document.documentElement.dataset.theme = s;
  } catch (e) {}
})();`;
