import { getMarketData } from "@/app/lib/market-data";

export async function GET() {
  return Response.json(await getMarketData());
}
