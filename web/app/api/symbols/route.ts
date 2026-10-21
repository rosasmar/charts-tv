import type { NextRequest } from "next/server";
import { searchSymbols } from "@/app/lib/symbol-search-data";

// GET /api/symbols?q=nvidia → { results: [{ symbol, name, kind }] }, for the
// phone's watchlist picker.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 40);
  return Response.json({ results: await searchSymbols(q) });
}
