import type { NextRequest } from "next/server";
import {
  isRedisAvailable,
  appendCommand,
  checkRateLimit,
  saveBackground,
  takeBackground,
} from "@/app/lib/redis";
import { checkUploadBody, checkUploadHeaders } from "@/app/lib/background";
import { isValidCode } from "@/app/lib/pairing-code";

// A fresh Response per request: a body can only be sent once.
const unavailable = () =>
  Response.json({ error: "remote_unavailable" }, { status: 503 });

// POST /api/remote/[code]/background — the phone uploads a background photo
// (a JPEG it has already cropped and shrunk). It waits in Redis and the TV
// learns about it through a "background" command in its normal polling.
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/remote/[code]/background">,
) {
  if (!isRedisAvailable()) return unavailable();

  const { code } = await ctx.params;
  const headerError = checkUploadHeaders(
    code,
    req.headers.get("content-type"),
    req.headers.get("content-length"),
  );
  if (headerError) {
    return Response.json({ error: headerError.error }, { status: headerError.status });
  }

  // Shares the per-code limit with text commands (R10).
  // TODO: Also limit uploads per client IP: codes aren't registered, so the
  // per-code limit alone doesn't stop one client spreading photos across
  // many made-up codes until they expire.
  const allowed = await checkRateLimit(code);
  if (!allowed) {
    return Response.json({ error: "too_many_requests" }, { status: 429 });
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  const bodyError = checkUploadBody(bytes);
  if (bodyError) {
    return Response.json({ error: bodyError.error }, { status: bodyError.status });
  }

  await saveBackground(code, Buffer.from(bytes).toString("base64"));
  const stored = await appendCommand(code, { type: "background" });
  return Response.json({ id: stored.id }, { status: 201 });
}

// GET /api/remote/[code]/background — the TV fetches the photo once. It's
// deleted in the same Redis command, so a photo only passes through.
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/remote/[code]/background">,
) {
  if (!isRedisAvailable()) return unavailable();

  const { code } = await ctx.params;
  if (!isValidCode(code)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const base64 = await takeBackground(code);
  if (!base64) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return new Response(new Uint8Array(Buffer.from(base64, "base64")), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
  });
}
