/**
 * R1: Pairing code — 6 characters from an unambiguous alphabet.
 * No O/0, I/1, L/1 to avoid misreads on a TV screen.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

// Uses the Web Crypto RNG (available in browsers and Node) rather than
// Math.random. The tiny modulo bias over a 31-character alphabet doesn't
// matter for a one-hour pairing code.
export function generatePairingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Returns true when `code` matches the pairing-code format (R1). */
export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}
