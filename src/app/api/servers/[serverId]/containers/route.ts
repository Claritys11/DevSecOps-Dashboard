import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guards";
import { listContainers } from "@/server/services/docker-service";

export async function GET(_request: Request, { params }: { params: Promise<{ serverId: string }> }) {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;
  const { serverId } = await params;

  try {
    const containers = await listContainers(serverId);
    return NextResponse.json({ source: "docker", containers });
  } catch (error) {
    const containers = await prisma.containerRecord.findMany({
      where: { serverId },
      orderBy: { name: "asc" }
    });
    return NextResponse.json({
      source: "cache",
      warning: error instanceof Error ? error.message : "Docker unavailable",
      containers
    });
  }
}
