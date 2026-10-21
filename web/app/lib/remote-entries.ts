import type { RemoteCommand } from "./remote-commands";

export type StoredCommand = { id: number; command: RemoteCommand };

// One stored list entry. @upstash/redis automatically JSON-parses values it
// reads, so an entry can come back as an object or (if stored or read some
// other way) as a JSON string. Anything malformed is dropped.
export function parseStoredEntry(raw: unknown): StoredCommand | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const { id, command } = value as { id?: unknown; command?: unknown };
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) return null;
  if (!command || typeof command !== "object" || typeof (command as { type?: unknown }).type !== "string") {
    return null;
  }
  return { id, command: command as RemoteCommand };
}

// Entries newer than `afterId`, oldest first, capped at `limit` (the newest
// ones win if there are more).
export function commandsAfter(entries: unknown[], afterId: number, limit = 20): StoredCommand[] {
  return entries
    .map(parseStoredEntry)
    .filter((e): e is StoredCommand => e !== null && e.id > afterId)
    .sort((a, b) => a.id - b.id)
    .slice(-limit);
}
