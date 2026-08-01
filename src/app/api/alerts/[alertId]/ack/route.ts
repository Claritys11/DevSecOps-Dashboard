import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/services/audit-service";

export async function POST(request: Request, { params }: { params: Promise<{ alertId: string }> }) {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;
  if (authResult.session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { alertId } = await params;
  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedById: authResult.session.user.id
    }
  });

  await writeAuditLog({
    userId: authResult.session.user.id,
    action: "SETTINGS_UPDATE",
    targetType: "alert",
    targetId: alertId,
    metadata: { ruleType: alert.ruleType, resourceType: alert.resourceType, resourceId: alert.resourceId, action: "acknowledge" },
    request
  });

  return NextResponse.json(alert);
}
