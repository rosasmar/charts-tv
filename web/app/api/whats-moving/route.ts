import type { NextRequest } from "next/server";
import { parseSymbolList } from "@/app/lib/market";
import { getWhatsMoving } from "@/app/lib/whats-moving-claude";

export async function GET(req: NextRequest) {
  return Response.json(await getWhatsMoving(parseSymbolList(req.nextUrl.searchParams.get("symbols"))));
}
