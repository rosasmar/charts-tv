"use client";

import { useEffect, useState } from "react";

interface Props {
  url: string;
  /** Size in rem. Default 9 (R2: scannable from ~2 m on 1080p). */
  size?: number;
}

/**
 * R2 — renders a QR code as inline SVG using the `qrcode` npm package.
 * No network call. White modules on black background with quiet zone.
 */
export function QrCode({ url, size = 9 }: Props) {
  const [svgString, setSvgString] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode").then((QRCode) => {
      QRCode.toString(url, {
        type: "svg",
        color: { dark: "#ffffff", light: "#000000" },
        margin: 2, // quiet zone in modules
        errorCorrectionLevel: "M",
      }).then((svg) => {
        if (!cancelled) setSvgString(svg);
      });
    });
    return () => { cancelled = true; };
  }, [url]);

  if (!svgString) return null;

  return (
    <div
      aria-label={`QR code for ${url}`}
      style={{ width: `${size}rem`, height: `${size}rem` }}
      // dangerouslySetInnerHTML is safe: the SVG is produced locally by
      // the qrcode library, never from user input or a network fetch.
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
}
