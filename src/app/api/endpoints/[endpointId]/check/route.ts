import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guards";
import { badRequest } from "@/server/http";
import { checkEndpoint, checkSslCertificate } from "@/server/services/monitoring-service";
import { writeAuditLog } from "@/server/services/audit-service";

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  const authResult = await requireRole("MAINTAINER");
  if ("response" in authResult) return authResult.response;
  const { endpointId } = await params;

  if (!(await prisma.monitoredEndpoint.count({ where: { id: endpointId } }))) return badRequest("Endpoint not found", 404);

  const [endpointCheck, sslCheck] = await Promise.all([checkEndpoint(endpointId), checkSslCertificate(endpointId)]);
  await writeAuditLog({
    userId: authResult.session.user.id,
    action: "ENDPOINT_CHECK",
    targetType: "endpoint",
    targetId: endpointId,
    metadata: { sslCheckId: sslCheck.id, status: endpointCheck.status },
    request
  });

  return NextResponse.json({ endpointCheck, sslCheck });
}
