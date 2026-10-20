/** Local hours during which the screen dims (start inclusive, end exclusive). */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 7;

// True between NIGHT_START_HOUR and NIGHT_END_HOUR in the TV's local time,
// handling the window that wraps past midnight.
export function isNightTime(
  date: Date,
  startHour = NIGHT_START_HOUR,
  endHour = NIGHT_END_HOUR,
): boolean {
  const hour = date.getHours();
  return startHour > endHour
    ? hour >= startHour || hour < endHour
    : hour >= startHour && hour < endHour;
}

export type DimSetting = "auto" | "on" | "off";

// ?dim=on / ?dim=off override the schedule (e.g. to show it in the demo).
export function readDimSetting(search: string): DimSetting {
  const value = new URLSearchParams(search).get("dim");
  return value === "on" || value === "off" ? value : "auto";
}
