import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/server/auth/guards";
import { parseBody } from "@/server/http";
import { enrollServer } from "@/server/services/enrollment-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { dockerAccessSchema } from "@/server/validators/server";

const createServerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    environment: z.string().trim().max(40).optional(),
    description: z.string().trim().max(500).optional()
  })
  .and(dockerAccessSchema);

export async function GET() {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;

  const servers = await prisma.server.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(servers);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;

  const body = await parseBody(request, createServerSchema);
  if ("response" in body) return body.response;

  const enrolled = await enrollServer(body.data);
  await writeAuditLog({
    userId: authResult.session.user.id,
    action: "SERVER_CREATE",
    targetType: "server",
    targetId: enrolled.server.id,
    metadata: { name: enrolled.server.name, agentId: enrolled.agentId, dockerAccess: body.data.dockerAccess },
    request
  });

  return NextResponse.json({ server: enrolled.server, agentId: enrolled.agentId, token: enrolled.token }, { status: 201 });
}
