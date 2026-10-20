"use client";

// A short two-note chime synthesized with Web Audio, so there's no audio file
// to ship: rising for alerts on the way up, falling on the way down.
let context: AudioContext | undefined;

function getContext(): AudioContext | undefined {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  context ??= new AudioContext();
  return context;
}

// Browsers keep audio suspended until a user gesture; on the TV any remote
// press counts. Call this from a keydown handler.
export function unlockAlertSound(): void {
  const ctx = getContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

export function playAlertSound(direction: "up" | "down"): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const notes = direction === "up" ? [660, 880] : [660, 440];
  notes.forEach((frequency, i) => {
    const start = ctx.currentTime + i * 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}
