import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/guards";
import { badRequest } from "@/server/http";
import { writeAuditLog } from "@/server/services/audit-service";

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;
  const { userId } = await params;

  if (userId === authResult.session.user.id) return badRequest("You cannot remove your own account");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return badRequest("User not found", 404);

  if (user.role === "ADMIN" && (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1) {
    return badRequest("Keep at least one admin account");
  }

  await prisma.user.delete({ where: { id: userId } });
  await writeAuditLog({
    userId: authResult.session.user.id,
    action: "USER_DELETE",
    targetType: "user",
    targetId: userId,
    metadata: { email: user.email },
    request
  });
  return NextResponse.json({ ok: true });
}
