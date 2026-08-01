import { requireUser } from "@/server/auth/guards";
import { getDashboardOverview } from "@/server/services/dashboard-service";
import { jsonResponse } from "@/lib/json";

export async function GET() {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;

  const overview = await getDashboardOverview();
  return jsonResponse(overview);
}
