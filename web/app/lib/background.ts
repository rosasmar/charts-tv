import { isValidCode } from "./pairing-code";

// The viewer's background photo, sent from the phone remote. Pure helpers
// shared by the phone (crop and size), the upload route (validation) and the
// TV (default opacity), so they can be tested without a browser or Redis.

/** The photo is cropped and scaled to fit a 1080p TV screen. */
export const BACKGROUND_WIDTH = 1920;
export const BACKGROUND_HEIGHT = 1080;

/**
 * Largest accepted photo, as JPEG bytes. Stored as base64 it's ~1.4 MB per
 * Redis request, far under Upstash's 10 MB request limit and Vercel's 4.5 MB
 * function body limit, and its data URL still fits in the TV's localStorage.
 */
export const MAX_BACKGROUND_BYTES = 1024 * 1024;

/** Opacity (%) for a fresh photo: low enough that text stays easy to read. */
export const DEFAULT_BACKGROUND_OPACITY = 35;

/** True for a whole-number opacity percentage from 0 to 100. */
export function isValidOpacity(pct: number): boolean {
  return Number.isInteger(pct) && pct >= 0 && pct <= 100;
}

/**
 * Where to crop a photo so it covers a 16:9 screen, like `object-fit: cover`
 * would, and the size to draw it at: never larger than 1920×1080 and never
 * upscaled. Cropping on the phone means none of the upload is wasted on parts
 * the TV would cut off anyway.
 */
export function coverCrop(
  width: number,
  height: number,
): { sx: number; sy: number; sw: number; sh: number; width: number; height: number } {
  const target = BACKGROUND_WIDTH / BACKGROUND_HEIGHT;
  const sw = width / height > target ? Math.round(height * target) : width;
  const sh = width / height > target ? height : Math.round(width / target);
  const scale = Math.min(1, BACKGROUND_WIDTH / sw);
  return {
    sx: Math.round((width - sw) / 2),
    sy: Math.round((height - sh) / 2),
    sw,
    sh,
    width: Math.round(sw * scale),
    height: Math.round(sh * scale),
  };
}

export type UploadError =
  | { status: 400; error: "bad_request" }
  | { status: 413; error: "too_large" }
  | { status: 415; error: "unsupported_media_type" };

/**
 * Checks an upload before its body is read: a valid pairing code, a JPEG
 * content type (the phone always re-encodes to JPEG) and, when the client
 * sends one, a Content-Length within the cap.
 */
export function checkUploadHeaders(
  code: string,
  contentType: string | null,
  contentLength: string | null,
): UploadError | null {
  if (!isValidCode(code)) return { status: 400, error: "bad_request" };
  if (contentType?.split(";")[0].trim().toLowerCase() !== "image/jpeg") {
    return { status: 415, error: "unsupported_media_type" };
  }
  if (contentLength !== null && Number(contentLength) > MAX_BACKGROUND_BYTES) {
    return { status: 413, error: "too_large" };
  }
  return null;
}

/** Checks the body itself: non-empty, within the cap, and really a JPEG. */
export function checkUploadBody(bytes: Uint8Array): UploadError | null {
  if (bytes.length === 0) return { status: 400, error: "bad_request" };
  if (bytes.length > MAX_BACKGROUND_BYTES) return { status: 413, error: "too_large" };
  // Every JPEG starts with an SOI marker followed by another marker.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return { status: 415, error: "unsupported_media_type" };
  }
  return null;
}
