import type { NextRequest } from "next/server";
import { getMarketData } from "@/app/lib/market-data";
import { parseSymbolList } from "@/app/lib/market";

// Prices for a list picked on the phone: /api/market/custom?symbols=AMZN,NVDA.
// A separate route because reading the query string makes a route render on
// every request; /api/market stays prerendered for the default board, which
// most TVs show. The data underneath is still cached per list and symbol.
// TODO: "use cache" is in-memory per server instance, so on serverless these
// lists share less than the prerendered route; try "use cache: remote" if
// upstream rate limits become a problem.
export async function GET(req: NextRequest) {
  return Response.json(await getMarketData(parseSymbolList(req.nextUrl.searchParams.get("symbols"))));
}
