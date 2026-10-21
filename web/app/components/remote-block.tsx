"use client";

import { QrCode } from "@/app/components/qr-code";
import { usePairing } from "@/app/lib/use-pairing-code";

/**
 * R1, R2: QR code + pairing code in the TV header, next to the wordmark.
 * Only rendered when Redis is configured (decided server-side in page.tsx).
 * The text sits beside the QR code so the header doesn't grow taller.
 */
export function RemoteBlock() {
  const pairing = usePairing();
  if (!pairing) return null;
  const url = `${pairing.origin}/remote/${pairing.code}`;
  return (
    <div className="flex items-center gap-[1.25rem]">
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
