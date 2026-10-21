import type { NextRequest } from "next/server";
import {
  isRedisAvailable,
  appendCommand,
  getCommandsAfter,
  checkRateLimit,
} from "@/app/lib/redis";
import { validateRemoteRequest } from "@/app/lib/validate-remote";
import { isValidCode } from "@/app/lib/pairing-code";

const UNAVAILABLE = Response.json(
  { error: "remote_unavailable" },
  { status: 503 },
);

// R6 — POST /api/remote/[code]/commands
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/remote/[code]/commands">,
) {
  if (!isRedisAvailable()) return UNAVAILABLE;

  const { code } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const result = validateRemoteRequest(code, body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  // Rate limiting (R10).
  const allowed = await checkRateLimit(code);
  if (!allowed) {
    return Response.json({ error: "too_many_requests" }, { status: 429 });
  }

  const stored = await appendCommand(code, result.command);
  return Response.json(stored, { status: 201 });
}

// R7 — GET /api/remote/[code]/commands?after=<id>
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/remote/[code]/commands">,
) {
  if (!isRedisAvailable()) return UNAVAILABLE;

  const { code } = await ctx.params;
  if (!isValidCode(code)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const afterStr = req.nextUrl.searchParams.get("after") ?? "0";
  const afterId = parseInt(afterStr, 10);
  if (!Number.isFinite(afterId)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const commands = await getCommandsAfter(code, afterId);
  return Response.json({ commands });
}
