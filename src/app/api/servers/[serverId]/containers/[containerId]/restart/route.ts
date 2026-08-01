import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { authorizeContainerAction, getContainerRecord, parseContainerActionRequest, reserveContainerAction } from "@/server/services/container-safety-service";
import { restartContainer } from "@/server/services/docker-service";
import { writeAuditLog } from "@/server/services/audit-service";

export async function POST(request: Request, { params }: { params: Promise<{ serverId: string; containerId: string }> }) {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;
  const { serverId, containerId } = await params;
  const container = await getContainerRecord(serverId, containerId);
  if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });

  const authError = authorizeContainerAction({ role: authResult.session.user.role, userId: authResult.session.user.id, action: "restart", container });
  if (authError) return NextResponse.json({ error: authError }, { status: authError === "Forbidden" ? 403 : 400 });

  const parsed = await parseContainerActionRequest(request, container, "restart");
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const duplicate = await reserveContainerAction({ idempotencyKey: parsed.data.idempotencyKey, serverId, containerId, action: "restart" });
  if (duplicate) return NextResponse.json({ error: duplicate }, { status: 409 });

  try {
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: "CONTAINER_RESTART",
      targetType: "container",
      targetId: containerId,
      metadata: { serverId, containerName: container.name, protectionLevel: container.protectionLevel, reason: parsed.data.reason, phase: "before", idempotencyKey: parsed.data.idempotencyKey },
      request
    });
    await restartContainer(serverId, containerId);
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: "CONTAINER_RESTART",
      targetType: "container",
      targetId: containerId,
      metadata: { serverId, containerName: container.name, protectionLevel: container.protectionLevel, reason: parsed.data.reason, phase: "after", idempotencyKey: parsed.data.idempotencyKey },
      request
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to restart container" },
      { status: 502 }
    );
  }
}
