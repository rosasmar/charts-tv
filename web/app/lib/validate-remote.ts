import { isValidCode } from "./pairing-code";
import { parseCommand, type RemoteCommand } from "./remote-commands";

export type ValidationOk = { ok: true; code: string; command: RemoteCommand };
export type ValidationError =
  | { ok: false; status: 400; error: "bad_request" }
  | { ok: false; status: 422; error: "not_understood" };

/**
 * Validates a remote command POST payload (R5, R6).
 * Pure — no I/O — so it can be tested without Redis.
 */
export function validateRemoteRequest(
  code: unknown,
  body: unknown,
): ValidationOk | ValidationError {
  if (
    typeof code !== "string" ||
    !isValidCode(code) ||
    typeof body !== "object" ||
    body === null
  ) {
    return { ok: false, status: 400, error: "bad_request" };
  }

  const { text } = body as { text?: unknown };
  if (typeof text !== "string" || text.length === 0 || text.length > 200) {
    return { ok: false, status: 400, error: "bad_request" };
  }

  const command = parseCommand(text);
  if (!command) {
    return { ok: false, status: 422, error: "not_understood" };
  }

  return { ok: true, code, command };
}
