import type { NextRequest } from "next/server";
import { getCandles } from "@/app/lib/candles-data";
import { parseSymbolList } from "@/app/lib/market";

export async function GET(req: NextRequest) {
  return Response.json(await getCandles(parseSymbolList(req.nextUrl.searchParams.get("symbols"))));
}
