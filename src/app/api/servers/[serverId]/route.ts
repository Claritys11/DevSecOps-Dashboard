import { NextResponse } from "next/server";
import { ServerRuntime } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/guards";
import { badRequest, isNotFound, parseBody } from "@/server/http";
import { writeAuditLog } from "@/server/services/audit-service";
import { dockerAccessSchema } from "@/server/validators/server";

const updateServerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    environment: z.string().trim().max(40).optional(),
    description: z.string().trim().max(500).optional()
  })
  .and(dockerAccessSchema);

type Params = { params: Promise<{ serverId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;
  const { serverId } = await params;

  const body = await parseBody(request, updateServerSchema);
  if ("response" in body) return body.response;

  const current = await prisma.server.findUnique({ where: { id: serverId } });
  if (!current) return badRequest("Server not found", 404);

  // systemd-nspawn machines keep their runtime; Docker access only toggles host vs remote.
  const runtime =
    current.runtime === ServerRuntime.SYSTEMD_NSPAWN
      ? current.runtime
      : body.data.dockerAccess === "local"
        ? ServerRuntime.HOST
        : ServerRuntime.REMOTE;

  const server = await prisma.server.update({
    where: { id: serverId },
    data: {
      name: body.data.name,
      environment: body.data.environment || current.environment,
      description: body.data.description || null,
      runtime,
      dockerEndpoint: body.data.dockerAccess === "remote" ? body.data.dockerEndpoint || null : null
    }
  });

  await writeAuditLog({
    userId: authResult.session.user.id,
    action: "SETTINGS_UPDATE",
    targetType: "server",
    targetId: serverId,
    metadata: { name: server.name, dockerAccess: body.data.dockerAccess },
    request
  });

  return NextResponse.json(server);
}

export async function DELETE(request: Request, { params }: Params) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;
  const { serverId } = await params;

  try {
    const server = await prisma.server.delete({ where: { id: serverId } });
    await prisma.alert.updateMany({
      where: { resourceId: { startsWith: serverId }, resolvedAt: null },
      data: { resolvedAt: new Date() }
    });
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: "SERVER_DELETE",
      targetType: "server",
      targetId: serverId,
      metadata: { name: server.name },
      request
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFound(error)) return badRequest("Server not found", 404);
    throw error;
  }
}
