import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/guards";
import { badRequest } from "@/server/http";
import { rotateAgentToken } from "@/server/services/enrollment-service";
import { writeAuditLog } from "@/server/services/audit-service";

export async function POST(request: Request, { params }: { params: Promise<{ serverId: string }> }) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;
  const { serverId } = await params;

  const exists = await prisma.server.count({ where: { id: serverId } });
  if (!exists) return badRequest("Server not found", 404);

  const rotated = await rotateAgentToken(serverId);
  await writeAuditLog({
    userId: authResult.session.user.id,
    action: "AGENT_TOKEN_ROTATE",
    targetType: "server",
    targetId: serverId,
    metadata: { agentId: rotated.agentId },
    request
  });

  return NextResponse.json({ agentId: rotated.agentId, token: rotated.token });
}
