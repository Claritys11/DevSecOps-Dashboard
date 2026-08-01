import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { getContainerLogs } from "@/server/services/docker-service";

export async function GET(_request: Request, { params }: { params: Promise<{ serverId: string; containerId: string }> }) {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;
  const { serverId, containerId } = await params;

  try {
    const logs = await getContainerLogs(serverId, containerId);
    return new NextResponse(logs, {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read container logs" },
      { status: 502 }
    );
  }
}
