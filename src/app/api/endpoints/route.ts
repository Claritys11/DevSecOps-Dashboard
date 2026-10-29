import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/server/auth/guards";
import { badRequest, parseBody } from "@/server/http";
import { writeAuditLog } from "@/server/services/audit-service";
import { explainBlockedUrl } from "@/server/services/endpoint-service";
import { endpointSchema } from "@/server/validators/endpoint";

export async function GET() {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;

  const endpoints = await prisma.monitoredEndpoint.findMany({
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: 10 },
      sslChecks: { orderBy: { checkedAt: "desc" }, take: 1 }
    },
    orderBy: { name: "asc" }
  });
  return NextResponse.json(endpoints);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;

  const body = await parseBody(request, endpointSchema);
  if ("response" in body) return body.response;

  const blocked = await explainBlockedUrl(body.data.url);
  if (blocked) return badRequest(blocked);

  const endpoint = await prisma.monitoredEndpoint.create({ data: { ...body.data, nextCheckAt: new Date() } });
  await writeAuditLog({
    userId: authResult.session.user.id,
    action: "ENDPOINT_CREATE",
    targetType: "endpoint",
    targetId: endpoint.id,
    metadata: { name: endpoint.name, url: endpoint.url },
    request
  });
  return NextResponse.json(endpoint, { status: 201 });
}
