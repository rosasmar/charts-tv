"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_BACKGROUND_OPACITY,
  MAX_BACKGROUND_BYTES,
  coverCrop,
} from "@/app/lib/background";

type Status =
  | "idle"
  | "sending"
  | "sent"
  | "unreadable"
  | "too_large"
  | "rate_limited"
  | "error"
  | "unreachable";

/** JPEG qualities to try, best first, until the photo fits under the cap. */
const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

class PhotoTooLarge extends Error {}

/**
 * Crops the photo to 16:9 at up to 1920×1080 and re-encodes it as a JPEG
 * under the cap. Drawing it on a canvas also drops its EXIF data, such as
 * where it was taken, so only the pixels leave the phone.
 */
async function preparePhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const crop = coverCrop(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.width, crop.height);
    for (const quality of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= MAX_BACKGROUND_BYTES) return blob;
    }
    throw new PhotoTooLarge();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Background photo for the TV: pick one, set how strongly it shows, or
 * remove it. A TV can't pick files, so this lives on the phone.
 */
export function BackgroundSection({ code }: { code: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [opacity, setOpacity] = useState(DEFAULT_BACKGROUND_OPACITY);
  const fileRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showStatus = (next: Status) => {
    setStatus(next);
    clearTimeout(statusTimer.current);
    if (next !== "sending") {
      statusTimer.current = setTimeout(() => setStatus("idle"), 3000);
    }
  };
  useEffect(() => () => clearTimeout(statusTimer.current), []);

  const statusFor = (res: Response): Status =>
    res.status === 201
      ? "sent"
      : res.status === 413
        ? "too_large"
        : res.status === 429
          ? "rate_limited"
          : res.status === 503
            ? "unreachable"
            : "error";

  // Opacity and Remove go through the normal text commands.
  const sendText = async (text: string) => {
    showStatus("sending");
    try {
      const res = await fetch(`/api/remote/${code}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      showStatus(statusFor(res));
    } catch {
      showStatus("unreachable");
    }
  };
  const sendTextRef = useRef(sendText);
  useEffect(() => {
    sendTextRef.current = sendText;
  });

  // Send the opacity once the slider is released (the native change event),
  // not on every step of a drag: the remote allows 30 commands a minute.
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;
    const commit = () => sendTextRef.current(`background opacity ${slider.value}%`);
    slider.addEventListener("change", commit);
    return () => slider.removeEventListener("change", commit);
  }, []);

  const upload = async (file: File) => {
    showStatus("sending");
    let photo: Blob;
    try {
      photo = await preparePhoto(file);
    } catch (error) {
      showStatus(error instanceof PhotoTooLarge ? "too_large" : "unreadable");
      return;
    }
    try {
      const res = await fetch(`/api/remote/${code}/background`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: photo,
      });
      showStatus(statusFor(res));
    } catch {
      showStatus("unreachable");
    }
  };

  const remove = () => {
    // The TV goes back to the default opacity too.
    setOpacity(DEFAULT_BACKGROUND_OPACITY);
    sendText("remove background");
  };

  const statusMessage: Record<Status, string> = {
    idle: "",
    sending: "Sending…",
    sent: "Sent ✓",
    unreadable: "Couldn't read that photo. Try another.",
    too_large: "That photo is too large. Try another.",
    rate_limited: "Too many changes. Try again in a minute.",
    error: "Something went wrong. Try again.",
    unreachable: "TV not reachable — check the code.",
  };

  return (
    <div style={styles.section}>
      <div style={styles.label}>Background</div>
      <div style={styles.row}>
        <button
          style={{ ...styles.btn, flex: 1 }}
          onClick={() => fileRef.current?.click()}
          disabled={status === "sending"}
        >
          Choose photo
        </button>
        <button style={styles.btn} onClick={remove} disabled={status === "sending"}>
          Remove
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so picking the same photo again still fires.
          e.target.value = "";
          if (file) upload(file);
        }}
      />
      <label style={styles.sliderRow}>
        <span>Opacity</span>
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={100}
          step={5}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          style={styles.slider}
        />
        <span style={styles.sliderValue}>{opacity}%</span>
      </label>
      <div
        style={{
          ...styles.statusLine,
          color:
            status === "sent"
              ? "#22c55e"
              : status === "idle" || status === "sending"
                ? "#8a8a8a"
                : "#ef4444",
        }}
        role="status"
        aria-live="polite"
      >
        {statusMessage[status]}
      </div>
    </div>
  );
}

// Matches the inline styles in remote-ui.tsx.
const styles: Record<string, React.CSSProperties> = {
  section: {
    marginBottom: "1.5rem",
  },
  label: {
    fontSize: "0.85rem",
    color: "#8a8a8a",
    marginBottom: "0.5rem",
  },
  row: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.75rem",
  },
  btn: {
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "0.75rem",
    color: "#f5f5f5",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "0.75rem 1rem",
    flexShrink: 0,
    touchAction: "manipulation",
  },
  sliderRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontSize: "0.9rem",
    color: "#a0a0a0",
  },
  slider: {
    flex: 1,
    minWidth: 0,
    accentColor: "#ffffff",
  },
  sliderValue: {
    width: "2.75rem",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    color: "#f5f5f5",
  },
  statusLine: {
    fontSize: "0.9rem",
    minHeight: "1.5rem",
    marginTop: "0.5rem",
  },
};
