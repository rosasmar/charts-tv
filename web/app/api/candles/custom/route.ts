import type { NextRequest } from "next/server";
import { getCandles, getMinuteCandles } from "@/app/lib/candles-data";
import { parseSymbolList } from "@/app/lib/market";

// Candles for a list picked on the phone: /api/candles/custom?symbols=AMZN,NVDA,
// plus &interval=1m for 1-minute candles. A separate route because reading the
// query string makes a route render on every request; /api/candles and
// /api/candles/1m stay prerendered for the default board, which most TVs show.
// The data underneath is still cached per symbol.
// TODO: "use cache" is in-memory per server instance, so on serverless these
// lists share less than the prerendered routes; try "use cache: remote" if
// upstream rate limits become a problem.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const symbols = parseSymbolList(params.get("symbols"));
  return Response.json(
    params.get("interval") === "1m" ? await getMinuteCandles(symbols) : await getCandles(symbols),
  );
}
