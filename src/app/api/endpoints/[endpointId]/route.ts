import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/guards";
import { badRequest, isNotFound, parseBody } from "@/server/http";
import { writeAuditLog } from "@/server/services/audit-service";
import { explainBlockedUrl } from "@/server/services/endpoint-service";
import { endpointUpdateSchema } from "@/server/validators/endpoint";

type Params = { params: Promise<{ endpointId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;
  const { endpointId } = await params;

  const body = await parseBody(request, endpointUpdateSchema);
  if ("response" in body) return body.response;

  if (body.data.url) {
    const blocked = await explainBlockedUrl(body.data.url);
    if (blocked) return badRequest(blocked);
  }

  try {
    const endpoint = await prisma.monitoredEndpoint.update({
      where: { id: endpointId },
      data: {
        ...body.data,
        // Re-check right away when the target changes or monitoring resumes.
        nextCheckAt: body.data.enabled === true || body.data.url ? new Date() : undefined,
        consecutiveFailures: body.data.url ? 0 : undefined
      }
    });
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: "ENDPOINT_UPDATE",
      targetType: "endpoint",
      targetId: endpointId,
      metadata: { name: endpoint.name, changes: Object.keys(body.data) },
      request
    });
    return NextResponse.json(endpoint);
  } catch (error) {
    if (isNotFound(error)) return badRequest("Endpoint not found", 404);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;
  const { endpointId } = await params;

  try {
    const endpoint = await prisma.monitoredEndpoint.delete({ where: { id: endpointId } });
    await prisma.alert.updateMany({ where: { resourceId: endpointId, resolvedAt: null }, data: { resolvedAt: new Date() } });
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: "ENDPOINT_DELETE",
      targetType: "endpoint",
      targetId: endpointId,
      metadata: { name: endpoint.name, url: endpoint.url },
      request
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFound(error)) return badRequest("Endpoint not found", 404);
    throw error;
  }
}
