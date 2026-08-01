import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/guards";

export async function GET() {
  const authResult = await requireAdmin();
  if ("response" in authResult) return authResult.response;

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return NextResponse.json(logs);
}
