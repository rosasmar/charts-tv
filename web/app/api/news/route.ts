import { getHeadlines } from "@/app/lib/news";

export async function GET() {
  return Response.json({ headlines: await getHeadlines() });
}
