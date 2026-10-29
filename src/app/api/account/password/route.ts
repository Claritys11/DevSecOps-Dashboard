import argon2 from "argon2";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guards";
import { badRequest, parseBody } from "@/server/http";
import { hashPassword } from "@/server/services/password-service";
import { checkRateLimit } from "@/server/services/rate-limit-service";
import { writeAuditLog } from "@/server/services/audit-service";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(12, "New password must be at least 12 characters").max(200)
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;
  const userId = authResult.session.user.id;

  if (!checkRateLimit(`password-change:${userId}`, 5, 15 * 60_000)) {
    return badRequest("Too many attempts. Try again in 15 minutes.", 429);
  }

  const body = await parseBody(request, schema);
  if ("response" in body) return body.response;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await argon2.verify(user.passwordHash, body.data.currentPassword))) {
    return badRequest("Current password is incorrect");
  }

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(body.data.newPassword) } });
  await writeAuditLog({ userId, action: "PASSWORD_CHANGE", targetType: "user", targetId: userId, request });
  return NextResponse.json({ ok: true });
}
