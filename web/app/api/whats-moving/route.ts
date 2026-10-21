import { getWhatsMoving } from "@/app/lib/whats-moving-claude";

export async function GET() {
  return Response.json(await getWhatsMoving());
}
