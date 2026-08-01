import { ContainerProtectionLevel } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/guards";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/services/audit-service";

const protectionSchema = z.object({
  protectionLevel: z.nativeEnum(ContainerProtectionLevel),
  reason: z.string().min(3).max(500)
});

export async function PATCH(request: Request, { params }: { params: Promise<{ serverId: string; containerId: string }> }) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;
  const { serverId, containerId } = await params;

  const parsed = protectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Protection level and reason are required" }, { status: 400 });
  }

  const current = await prisma.containerRecord.findUnique({
    where: { serverId_dockerId: { serverId, dockerId: containerId } }
  });
  if (!current) {
    return NextResponse.json({ error: "Container not found" }, { status: 404 });
  }

  const updated = await prisma.containerRecord.update({
    where: { serverId_dockerId: { serverId, dockerId: containerId } },
    data: {
      protectionLevel: parsed.data.protectionLevel,
      protectionOverride: true
    }
  });

  await writeAuditLog({
    userId: authResult.session.user.id,
    action: "SETTINGS_UPDATE",
    targetType: "container_protection",
    targetId: containerId,
    metadata: {
      serverId,
      containerName: current.name,
      from: current.protectionLevel,
      to: updated.protectionLevel,
      reason: parsed.data.reason
    },
    request
  });

  return NextResponse.json(updated);
}
