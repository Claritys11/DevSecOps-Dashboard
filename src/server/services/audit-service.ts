import { AuditAction, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  userId?: string;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  request?: Request;
}) {
  const headers = input.request?.headers;
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ipAddress: headers?.get("x-forwarded-for")?.split(",")[0] ?? null,
      userAgent: headers?.get("user-agent")
    }
  });
}
