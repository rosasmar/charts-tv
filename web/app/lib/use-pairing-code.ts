"use client";

import { useSyncExternalStore } from "react";
import { generatePairingCode } from "./pairing-code";

// One pairing code per page load, shared by every component that needs it
// (the QR code in the header and the command polling in the dashboard).
// It's created lazily in the browser; on the server the hook returns null, so
// prerendering stays deterministic and hydration never mismatches.
let pairing: { code: string; origin: string } | undefined;

function getSnapshot() {
  pairing ??= { code: generatePairingCode(), origin: window.location.origin };
  return pairing;
}

const getServerSnapshot = () => null;
const subscribe = () => () => {};

export function usePairing(): { code: string; origin: string } | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
