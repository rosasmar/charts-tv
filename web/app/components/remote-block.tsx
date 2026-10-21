"use client";

import { useEffect, useState } from "react";
import { QrCode } from "@/app/components/qr-code";
import { usePairing } from "@/app/lib/use-pairing-code";

/** How long the QR code stays up after launch or the last remote input. */
const SHOW_MS = 30_000;

/** Dispatched on window when a phone command arrives, to keep the QR code up. */
export const REMOTE_ACTIVITY_EVENT = "chartstv:remote-activity";

// Shown at launch, then faded out after SHOW_MS so the always-on board stays
// minimal. Any remote press or phone command brings it back for another SHOW_MS.
function useShownAfterActivity(): boolean {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    let timer = setTimeout(() => setShown(false), SHOW_MS);
    const wake = () => {
      setShown(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(false), SHOW_MS);
    };
    window.addEventListener("keydown", wake);
    window.addEventListener(REMOTE_ACTIVITY_EVENT, wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", wake);
      window.removeEventListener(REMOTE_ACTIVITY_EVENT, wake);
    };
  }, []);
  return shown;
}

/**
 * R1, R2: QR code + pairing code in the TV header, next to the wordmark.
 * Only rendered when Redis is configured (decided server-side in page.tsx).
 * The text sits beside the QR code so the header doesn't grow taller. When it
 * fades out it keeps its space, so the header never jumps.
 */
export function RemoteBlock() {
  const pairing = usePairing();
  const shown = useShownAfterActivity();
  if (!pairing) return null;
  const url = `${pairing.origin}/remote/${pairing.code}`;
  return (
    <div
      aria-hidden={!shown}
      className={`flex items-center gap-[1.25rem] transition-opacity duration-1000 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="text-right">
        <div className="text-[1.125rem] text-muted">Scan to control</div>
        <div className="mt-[0.25rem] font-mono text-[1.5rem] tracking-[0.25em]">
          {pairing.code}
        </div>
      </div>
      <QrCode url={url} size={8.5} />
    </div>
  );
}
