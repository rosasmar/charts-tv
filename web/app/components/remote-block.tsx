"use client";

import { QrCode } from "@/app/components/qr-code";

interface Props {
  code: string;
  origin: string;
}

/**
 * R1, R2 — QR code + pairing code shown in the TV header.
 * Renders only when Redis is configured (checked server-side; hidden otherwise).
 */
export function RemoteBlock({ code, origin }: Props) {
  const url = `${origin}/remote/${code}`;
  return (
    <div className="flex flex-col items-center gap-[0.5rem]">
      <QrCode url={url} size={9} />
      <div className="text-[1rem] font-mono text-muted tracking-widest">
        {code}
      </div>
      <div className="text-[0.85rem] text-muted">Scan to control</div>
    </div>
  );
}
