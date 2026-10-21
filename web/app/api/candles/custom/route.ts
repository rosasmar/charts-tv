import type { NextRequest } from "next/server";
import { getCandles } from "@/app/lib/candles-data";
import { parseSymbolList } from "@/app/lib/market";

// Candles for a list picked on the phone: /api/candles/custom?symbols=AMZN,NVDA.
// A separate route because reading the query string makes a route render on
// every request; /api/candles stays prerendered for the default board, which
// most TVs show. The data underneath is still cached per list and symbol.
// TODO: "use cache" is in-memory per server instance, so on serverless these
// lists share less than the prerendered route; try "use cache: remote" if
// upstream rate limits become a problem.
export async function GET(req: NextRequest) {
  return Response.json(await getCandles(parseSymbolList(req.nextUrl.searchParams.get("symbols"))));
}
