import { getCandles } from "@/app/lib/candles-data";

export async function GET() {
  return Response.json(await getCandles());
}
