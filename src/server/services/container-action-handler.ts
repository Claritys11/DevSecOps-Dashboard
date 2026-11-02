import { NextResponse } from "next/server";
import type { AuditAction } from "@prisma/client";
import { requireUser } from "@/server/auth/guards";
import { writeAuditLog } from "@/server/services/audit-service";
import { authorizeContainerAction, getContainerRecord, parseContainerActionRequest, reserveContainerAction, type ContainerAction } from "@/server/services/container-safety-service";
import { recordActionInProject } from "@/server/services/docker-service";

const auditActions: Record<ContainerAction, AuditAction> = { restart: "CONTAINER_RESTART", stop: "CONTAINER_STOP", delete: "CONTAINER_DELETE" };

/** Shared flow for restart, stop and delete: authorize, audit, act, then record the reason in the project folder. */
export async function handleContainerAction(
  request: Request,
  params: Promise<{ serverId: string; containerId: string }>,
  action: ContainerAction,
  run: (serverId: string, containerId: string) => Promise<void>
) {
  const authResult = await requireUser();
  if ("response" in authResult) return authResult.response;
  const { user } = authResult.session;
  const { serverId, containerId } = await params;

  const container = await getContainerRecord(serverId, containerId);
  if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });

  const authError = authorizeContainerAction({ role: user.role, userId: user.id, action, container });
  if (authError) return NextResponse.json({ error: authError }, { status: authError === "Forbidden" ? 403 : 400 });

  const parsed = await parseContainerActionRequest(request, container, action);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { reason, idempotencyKey } = parsed.data;
  const duplicate = await reserveContainerAction({ idempotencyKey, serverId, containerId, action });
  if (duplicate) return NextResponse.json({ error: duplicate }, { status: 409 });

  const metadata = { serverId, containerName: container.name, protectionLevel: container.protectionLevel, reason, idempotencyKey };
  const audit = (extra: Record<string, unknown>) =>
    writeAuditLog({
      userId: user.id,
      action: auditActions[action],
      targetType: "container",
      targetId: containerId,
      metadata: JSON.parse(JSON.stringify({ ...metadata, ...extra })),
      request
    });

  await audit({ phase: "before" });
  try {
    await run(serverId, containerId);
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unable to ${action} container`;
    await audit({ phase: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const reasonFile = await recordActionInProject({ serverId, containerName: container.name, labels: container.labels, action, user: user.email ?? user.id, reason });
  await audit({ phase: "after", reasonFile });
  return NextResponse.json({ ok: true, reasonFile });
}
