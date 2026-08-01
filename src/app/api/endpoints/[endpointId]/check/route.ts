import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guards";
import { checkEndpoint, checkSslCertificate } from "@/server/services/monitoring-service";
import { writeAuditLog } from "@/server/services/audit-service";

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;
  const { endpointId } = await params;

  const [endpointCheck, sslCheck] = await Promise.all([checkEndpoint(endpointId), checkSslCertificate(endpointId)]);
  const sslCheckId = typeof sslCheck === "object" && sslCheck !== null && "id" in sslCheck ? String(sslCheck.id) : null;
  await writeAuditLog({
    userId: authResult.session.user.id,
    action: "ENDPOINT_CHECK",
    targetType: "endpoint",
    targetId: endpointId,
    metadata: { sslCheckId },
    request
  });

  return NextResponse.json({ endpointCheck, sslCheck });
}
