import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/guards";
import { badRequest, isUniqueViolation, parseBody } from "@/server/http";
import { hashPassword } from "@/server/services/password-service";
import { writeAuditLog } from "@/server/services/audit-service";

const createUserSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters").max(200),
  role: z.nativeEnum(Role).default(Role.VIEWER)
});

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;

  const body = await parseBody(request, createUserSchema);
  if ("response" in body) return body.response;

  try {
    const user = await prisma.user.create({
      data: {
        name: body.data.name || null,
        email: body.data.email,
        role: body.data.role,
        passwordHash: await hashPassword(body.data.password)
      },
      select: { id: true, email: true, name: true, role: true }
    });
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: "USER_CREATE",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email, role: user.role },
      request
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return badRequest("A user with that email already exists", 409);
    throw error;
  }
}
