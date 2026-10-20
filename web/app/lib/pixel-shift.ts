/** Offsets (in rem) the screen steps through: centre, then around a ring. */
const SHIFT_REM = 0.375; // 6px on a 1920px TV
const PATTERN: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** How long the screen holds each position. */
export const PIXEL_SHIFT_INTERVAL_MS = 2 * 60_000;

// Returns the offset for a given step of the burn-in cycle. Over one cycle
// (9 steps, 18 minutes) every static edge on screen visits 9 slightly
// different pixels, which spreads the wear on OLED and plasma panels.
export function pixelShiftOffset(step: number): { xRem: number; yRem: number } {
  const [x, y] = PATTERN[((step % PATTERN.length) + PATTERN.length) % PATTERN.length];
  return { xRem: x * SHIFT_REM, yRem: y * SHIFT_REM };
}
