import type { NextRequest } from "next/server";
import { getMarketData } from "@/app/lib/market-data";
import { parseSymbolList } from "@/app/lib/market";

export async function GET(req: NextRequest) {
  return Response.json(await getMarketData(parseSymbolList(req.nextUrl.searchParams.get("symbols"))));
}
