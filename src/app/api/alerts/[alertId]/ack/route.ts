import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { prisma } from "@/lib/prisma";
import { badRequest, isNotFound } from "@/server/http";
import { writeAuditLog } from "@/server/services/audit-service";

export async function POST(request: Request, { params }: { params: Promise<{ alertId: string }> }) {
  const authResult = await requireRole("MAINTAINER");
  if ("response" in authResult) return authResult.response;

  const { alertId } = await params;
  try {
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: { acknowledgedAt: new Date(), acknowledgedById: authResult.session.user.id }
    });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: "ALERT_ACK",
      targetType: "alert",
      targetId: alertId,
      metadata: { title: alert.title, ruleType: alert.ruleType, resourceType: alert.resourceType, resourceId: alert.resourceId },
      request
    });

    return NextResponse.json(alert);
  } catch (error) {
    if (isNotFound(error)) return badRequest("Alert not found", 404);
    throw error;
  }
}
