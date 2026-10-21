import "server-only";
import { Redis } from "@upstash/redis";
import type { RemoteCommand } from "./remote-commands";
import { commandsAfter, type StoredCommand } from "./remote-entries";

/**
 * Lazy Redis client — supports both Vercel KV env var names and the
 * plain Upstash REST env var names (R8).
 *
 * Returns null when Redis isn't configured (R9), so callers can return 503.
 */

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url =
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    "";
  const token =
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    "";

  if (!url || !token) {
    _redis = null;
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

/** True when Redis is configured and the remote feature is available. */
export function isRedisAvailable(): boolean {
  return getRedis() !== null;
}

/** Redis key for a pairing code's command list. */
export function remoteKey(code: string): string {
  return `remote:${code}`;
}

/** Redis key for the rate-limit counter for a pairing code (R10). */
export function rateLimitKey(code: string): string {
  return `remote:${code}:rl`;
}

/** TTL for command lists — 1 hour (R8). */
export const COMMAND_TTL = 3600;
/** Max commands kept per code (R8). */
export const MAX_COMMANDS = 50;
/** Rate limit: 30 POSTs per code per minute (R10). */
export const RATE_LIMIT = 30;
export const RATE_WINDOW = 60;

/** Redis key for a pairing code's command-id counter. */
export function sequenceKey(code: string): string {
  return `remote:${code}:seq`;
}

/**
 * Append a command and return it with its id.
 *
 * Ids come from an atomic INCR counter, so they keep increasing after the
 * list is trimmed and two concurrent POSTs can never get the same id. The
 * entry is written once, and push + trim + both TTLs go in one round trip.
 * Throws if Redis is unavailable (callers check `isRedisAvailable` first).
 */
export async function appendCommand(
  code: string,
  command: RemoteCommand,
): Promise<StoredCommand> {
  const redis = getRedis()!;
  const key = remoteKey(code);
  const id = await redis.incr(sequenceKey(code));
  const stored: StoredCommand = { id, command };

  const pipeline = redis.pipeline();
  pipeline.rpush(key, JSON.stringify(stored));
  pipeline.ltrim(key, -MAX_COMMANDS, -1);
  pipeline.expire(key, COMMAND_TTL);
  pipeline.expire(sequenceKey(code), COMMAND_TTL);
  await pipeline.exec();
  return stored;
}

/** Commands with id > afterId, oldest first, at most 20 (R7). */
export async function getCommandsAfter(
  code: string,
  afterId: number,
): Promise<StoredCommand[]> {
  const redis = getRedis()!;
  const raw = await redis.lrange<unknown>(remoteKey(code), 0, -1);
  return commandsAfter(raw, afterId, 20);
}

/**
 * Check and increment rate limit counter.
 * Returns true when the request is allowed, false when over the limit (R10).
 */
export async function checkRateLimit(code: string): Promise<boolean> {
  const redis = getRedis()!;
  const key = rateLimitKey(code);
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, RATE_WINDOW);
  const results = await pipeline.exec();
  const count = results[0] as number;
  return count <= RATE_LIMIT;
}

/** Redis key for a background photo on its way from the phone to the TV. */
export function backgroundKey(code: string): string {
  return `remote:${code}:bg`;
}

/**
 * A photo only waits here until the TV fetches it, which normally takes a
 * few seconds; if the TV never does, it expires after 10 minutes.
 */
export const BACKGROUND_TTL = 600;

/** Store a photo (base64 JPEG) for the TV to fetch, replacing any earlier one. */
export async function saveBackground(code: string, base64: string): Promise<void> {
  await getRedis()!.set(backgroundKey(code), base64, { ex: BACKGROUND_TTL });
}

/**
 * Return the stored photo and delete it in the same command (GETDEL), so it
 * leaves the server the moment the TV has it, and a newer upload arriving
 * meanwhile can't be deleted by mistake. Null when there's none.
 */
export async function takeBackground(code: string): Promise<string | null> {
  // Base64 of a JPEG starts with "/9j/", so the client's automatic JSON
  // parsing always falls back to returning the raw string.
  return getRedis()!.getdel<string>(backgroundKey(code));
}
