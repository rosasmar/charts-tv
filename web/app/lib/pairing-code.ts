/**
 * R1: Pairing code — 6 characters from an unambiguous alphabet.
 * No O/0, I/1, L/1 to avoid misreads on a TV screen.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function generatePairingCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    chars.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  }
  return chars.join("");
}

/** Returns true when `code` matches the pairing-code format (R1). */
export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}
