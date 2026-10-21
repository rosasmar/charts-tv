import { getMinuteCandles } from "@/app/lib/candles-data";

// Its own route rather than /api/candles?interval=1m: reading the query
// string would render /api/candles per request, where "use cache" isn't
// shared between serverless instances. Both routes stay prerendered and
// revalidate in the background, so every TV shares one upstream fetch.
export async function GET() {
  return Response.json(await getMinuteCandles());
}
