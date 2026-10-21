import type { NextRequest } from "next/server";
import { parseSymbolList } from "@/app/lib/market";
import { getWhatsMoving } from "@/app/lib/whats-moving-claude";

// What's moving for a list picked on the phone: /api/whats-moving/custom?symbols=AMZN,NVDA.
// A separate route because reading the query string makes a route render on
// every request; /api/whats-moving stays prerendered for the default board, which
// most TVs show. The data underneath is still cached per list and symbol.
// TODO: "use cache" is in-memory per server instance, so on serverless these
// lists share less than the prerendered route; try "use cache: remote" if
// upstream rate limits become a problem.
export async function GET(req: NextRequest) {
  return Response.json(await getWhatsMoving(parseSymbolList(req.nextUrl.searchParams.get("symbols"))));
}
