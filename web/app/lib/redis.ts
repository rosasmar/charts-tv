import "server-only";
import { Redis } from "@upstash/redis";

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

export type StoredCommand = { id: number; command: object };

/**
 * Append a command, refresh TTL, trim list.
 * Returns the stored entry with its auto-incremented id.
 * Throws if Redis is unavailable (caller should check `isRedisAvailable` first).
 */
export async function appendCommand(
  code: string,
  command: object,
): Promise<{ id: number; command: object }> {
  const redis = getRedis()!;
  const key = remoteKey(code);

  // Use a pipeline so the three ops are sent in one round trip.
  const pipeline = redis.pipeline();

  // We store JSON strings in the list; id = list length after push.
  const entry = { id: 0, command }; // placeholder id, replaced below
  pipeline.rpush(key, JSON.stringify(entry));
  pipeline.llen(key);
  pipeline.expire(key, COMMAND_TTL);
  const results = await pipeline.exec();
  const len = results[1] as number;

  // Overwrite placeholder id with the real sequence number.
  const stored: { id: number; command: object } = { id: len, command };
  // Rewrite last element with the correct id.
  await redis.lset(key, len - 1, JSON.stringify(stored));

  // Trim to last MAX_COMMANDS entries.
  if (len > MAX_COMMANDS) {
    await redis.ltrim(key, len - MAX_COMMANDS, -1);
  }

  return stored;
}

/**
 * Return commands with id > afterId, at most 20 (R7).
 */
export async function getCommandsAfter(
  code: string,
  afterId: number,
): Promise<{ id: number; command: object }[]> {
  const redis = getRedis()!;
  const raw = await redis.lrange(remoteKey(code), 0, -1);
  const all = (raw as string[]).map((s) => {
    try {
      return JSON.parse(s) as { id: number; command: object };
    } catch {
      return null;
    }
  }).filter(Boolean) as { id: number; command: object }[];

  return all.filter((c) => c.id > afterId).slice(-20);
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
